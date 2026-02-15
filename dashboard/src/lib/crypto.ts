/**
 * Client-side encryption for sensitive skill config fields.
 *
 * Secret fields (API keys, tokens) are encrypted before syncing to Supabase.
 * The encryption key is derived from the user's wallet signature, meaning:
 * - The server NEVER sees plaintext secrets
 * - Only the wallet owner can decrypt their data
 * - Losing the wallet = losing access to encrypted fields
 *
 * Uses AES-GCM (256-bit) via Web Crypto API.
 */

const ENCRYPTION_SALT = "clawsight-v1-secret-encryption";
const IV_LENGTH = 12;

/**
 * Derive an AES-256-GCM key from a wallet signature.
 * The user signs a deterministic message; the signature becomes the key material.
 */
export async function deriveEncryptionKey(
  walletSignature: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(walletSignature),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(ENCRYPTION_SALT),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string. Returns a base64-encoded string containing IV + ciphertext.
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  // Prefix IV to ciphertext
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64-encoded string (IV + ciphertext) back to plaintext.
 */
export async function decrypt(
  encoded: string,
  key: CryptoKey
): Promise<string> {
  const combined = new Uint8Array(
    atob(encoded)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * The deterministic message the user signs to derive the encryption key.
 * This is NOT a transaction — it's a free signature that proves wallet ownership.
 */
export const ENCRYPTION_SIGN_MESSAGE =
  "ClawSight: Sign this message to encrypt your secret keys.\n\nThis does NOT send a transaction or cost any gas.\n\nPurpose: Derive an encryption key so your API keys and tokens are encrypted before being stored.";

// ============================================================
// Config encryption helpers
// ============================================================

import { FormField } from "@/types";

/**
 * Given a skill's form fields and a config object, encrypt all secret-type fields.
 * Non-secret fields pass through unchanged.
 */
export async function encryptSecretFields(
  fields: FormField[],
  config: Record<string, unknown>,
  key: CryptoKey
): Promise<Record<string, unknown>> {
  const result = { ...config };

  for (const field of fields) {
    if (field.type === "secret" && typeof result[field.key] === "string") {
      const value = result[field.key] as string;
      if (value && !isEncrypted(value)) {
        result[field.key] = `enc:${await encrypt(value, key)}`;
      }
    }
  }

  return result;
}

/**
 * Given a skill's form fields and a config object, decrypt all secret-type fields.
 */
export async function decryptSecretFields(
  fields: FormField[],
  config: Record<string, unknown>,
  key: CryptoKey
): Promise<Record<string, unknown>> {
  const result = { ...config };

  for (const field of fields) {
    if (field.type === "secret" && typeof result[field.key] === "string") {
      const value = result[field.key] as string;
      if (value && isEncrypted(value)) {
        try {
          result[field.key] = await decrypt(value.slice(4), key);
        } catch {
          // If decryption fails, leave the encrypted value
          // (could be wrong wallet or corrupted data)
          result[field.key] = "";
        }
      }
    }
  }

  return result;
}

/**
 * Check if a value is already encrypted (prefixed with "enc:").
 */
function isEncrypted(value: string): boolean {
  return value.startsWith("enc:");
}

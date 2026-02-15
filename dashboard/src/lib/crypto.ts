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
const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000; // NIST SP 800-132 recommended minimum for SHA-256

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
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing [version(1B)][IV(12B)][ciphertext].
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

  // [version][iv][ciphertext]
  const combined = new Uint8Array(1 + iv.length + new Uint8Array(ciphertext).length);
  combined[0] = ENCRYPTION_VERSION;
  combined.set(iv, 1);
  combined.set(new Uint8Array(ciphertext), 1 + iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64-encoded string back to plaintext.
 * Supports versioned format [version(1B)][IV][ciphertext] and legacy [IV][ciphertext].
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

  let iv: Uint8Array<ArrayBuffer>;
  let ciphertext: Uint8Array<ArrayBuffer>;

  // Check for version byte
  if (combined[0] === ENCRYPTION_VERSION) {
    iv = new Uint8Array(combined.slice(1, 1 + IV_LENGTH));
    ciphertext = new Uint8Array(combined.slice(1 + IV_LENGTH));
  } else {
    // Legacy format: [IV][ciphertext] (no version byte)
    iv = new Uint8Array(combined.slice(0, IV_LENGTH));
    ciphertext = new Uint8Array(combined.slice(IV_LENGTH));
  }

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
 * Throws DecryptionError if decryption fails (wrong wallet or corrupted data).
 */
export class DecryptionError extends Error {
  constructor(fieldKey: string, cause?: unknown) {
    super(`Failed to decrypt field "${fieldKey}". Wrong wallet or corrupted data.`);
    this.name = "DecryptionError";
    this.cause = cause;
  }
}

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
        } catch (err) {
          throw new DecryptionError(field.key, err);
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

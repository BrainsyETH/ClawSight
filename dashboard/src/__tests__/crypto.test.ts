/**
 * Tests for @/lib/crypto
 *
 * NOTE: vitest is not yet installed in this project.
 * See utils.test.ts header for setup instructions.
 *
 * These tests rely on the Web Crypto API (SubtleCrypto). Node 20+ provides
 * crypto.subtle globally, but older Node versions or some test environments
 * may not. The tests detect availability and skip gracefully if missing.
 */

import { describe, it, expect, beforeAll } from "vitest";
import type { FormField } from "@/types";

// We conditionally import so the test file itself does not crash in
// environments that lack SubtleCrypto at module-evaluation time.
const cryptoModule = await import("@/lib/crypto");

const {
  deriveEncryptionKey,
  encrypt,
  decrypt,
  encryptSecretFields,
  decryptSecretFields,
} = cryptoModule;

// ---------------------------------------------------------------------------
// Detect SubtleCrypto availability
// ---------------------------------------------------------------------------
const hasSubtleCrypto =
  typeof globalThis.crypto !== "undefined" &&
  typeof globalThis.crypto.subtle !== "undefined";

// Wrap describe so the entire suite is skipped when SubtleCrypto is absent.
const maybDescribe = hasSubtleCrypto ? describe : describe.skip;

maybDescribe("crypto – encrypt / decrypt round-trip", () => {
  let key: CryptoKey;

  beforeAll(async () => {
    // Derive a key from a fake wallet signature
    key = await deriveEncryptionKey("fake-wallet-signature-0xDEADBEEF");
  });

  it("encrypt then decrypt returns original plaintext", async () => {
    const plaintext = "my-super-secret-api-key-12345";
    const ciphertext = await encrypt(plaintext, key);

    // Ciphertext is a base64 string, different from plaintext
    expect(ciphertext).not.toBe(plaintext);
    expect(typeof ciphertext).toBe("string");

    const decrypted = await decrypt(ciphertext, key);
    expect(decrypted).toBe(plaintext);
  });

  it("encrypt produces different ciphertext each time (random IV)", async () => {
    const plaintext = "same-input";
    const ct1 = await encrypt(plaintext, key);
    const ct2 = await encrypt(plaintext, key);
    expect(ct1).not.toBe(ct2); // Different IVs => different ciphertext
  });

  it("decrypt with wrong key throws or returns garbled data", async () => {
    const otherKey = await deriveEncryptionKey("different-wallet-sig");
    const ciphertext = await encrypt("secret", key);
    await expect(decrypt(ciphertext, otherKey)).rejects.toThrow();
  });

  it("handles empty string plaintext", async () => {
    const ciphertext = await encrypt("", key);
    const decrypted = await decrypt(ciphertext, key);
    expect(decrypted).toBe("");
  });

  it("handles unicode plaintext", async () => {
    const plaintext = "Hllo wrld! Caf\u00e9 \u2603\ufe0f";
    const ciphertext = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, key);
    expect(decrypted).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// encryptSecretFields / decryptSecretFields
// ---------------------------------------------------------------------------
maybDescribe("crypto – encryptSecretFields / decryptSecretFields", () => {
  let key: CryptoKey;

  const sampleFields: FormField[] = [
    { key: "api_key", type: "secret", label: "API Key" },
    { key: "provider", type: "select", label: "Provider", options: [], default: "google" },
    { key: "bot_token", type: "secret", label: "Bot Token" },
    { key: "enabled", type: "toggle", label: "Enabled", default: true },
  ];

  beforeAll(async () => {
    key = await deriveEncryptionKey("test-wallet-sig-for-field-encryption");
  });

  it("only encrypts fields with type 'secret'", async () => {
    const config = {
      api_key: "sk-abc123",
      provider: "google",
      bot_token: "xoxb-token-value",
      enabled: true,
    };

    const encrypted = await encryptSecretFields(sampleFields, config, key);

    // Secret fields should be encrypted (prefixed with "enc:")
    expect(typeof encrypted.api_key).toBe("string");
    expect((encrypted.api_key as string).startsWith("enc:")).toBe(true);

    expect(typeof encrypted.bot_token).toBe("string");
    expect((encrypted.bot_token as string).startsWith("enc:")).toBe(true);

    // Non-secret fields should be unchanged
    expect(encrypted.provider).toBe("google");
    expect(encrypted.enabled).toBe(true);
  });

  it("does not double-encrypt already encrypted values", async () => {
    const config = {
      api_key: "sk-abc123",
      provider: "google",
      bot_token: "",
      enabled: true,
    };

    const encrypted1 = await encryptSecretFields(sampleFields, config, key);
    const encrypted2 = await encryptSecretFields(sampleFields, encrypted1, key);

    // api_key should still have exactly one "enc:" prefix
    const val = encrypted2.api_key as string;
    expect(val.startsWith("enc:")).toBe(true);
    expect(val.startsWith("enc:enc:")).toBe(false);
  });

  it("decryptSecretFields restores original plaintext values", async () => {
    const original = {
      api_key: "sk-abc123",
      provider: "google",
      bot_token: "xoxb-token-value",
      enabled: true,
    };

    const encrypted = await encryptSecretFields(sampleFields, original, key);
    const decrypted = await decryptSecretFields(sampleFields, encrypted, key);

    expect(decrypted.api_key).toBe("sk-abc123");
    expect(decrypted.bot_token).toBe("xoxb-token-value");
    expect(decrypted.provider).toBe("google");
    expect(decrypted.enabled).toBe(true);
  });

  it("leaves empty string secret fields untouched", async () => {
    const config = {
      api_key: "",
      provider: "google",
      bot_token: "",
      enabled: true,
    };

    const encrypted = await encryptSecretFields(sampleFields, config, key);
    // Empty strings should not be encrypted
    expect(encrypted.api_key).toBe("");
    expect(encrypted.bot_token).toBe("");
  });

  it("decryptSecretFields with wrong key sets field to empty string", async () => {
    const config = {
      api_key: "sk-secret",
      provider: "bing",
      bot_token: "xoxb-123",
      enabled: false,
    };

    const encrypted = await encryptSecretFields(sampleFields, config, key);

    const wrongKey = await deriveEncryptionKey("wrong-wallet-signature");
    const decrypted = await decryptSecretFields(sampleFields, encrypted, wrongKey);

    // Decryption with wrong key falls back to empty string (per the catch block)
    expect(decrypted.api_key).toBe("");
    expect(decrypted.bot_token).toBe("");
    // Non-secret fields still unchanged
    expect(decrypted.provider).toBe("bing");
    expect(decrypted.enabled).toBe(false);
  });

  it("handles non-string values in secret fields gracefully", async () => {
    const config = {
      api_key: 12345 as unknown, // wrong type in the config
      provider: "google",
      bot_token: null as unknown,
      enabled: true,
    };

    // Should not throw — non-string secret fields are skipped
    const encrypted = await encryptSecretFields(
      sampleFields,
      config as Record<string, unknown>,
      key
    );
    expect(encrypted.api_key).toBe(12345);
    expect(encrypted.bot_token).toBeNull();
  });
});

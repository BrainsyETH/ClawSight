"use client";

import { useState, useCallback, useRef } from "react";
import {
  deriveEncryptionKey,
  encryptSecretFields,
  decryptSecretFields,
  ENCRYPTION_SIGN_MESSAGE,
} from "@/lib/crypto";
import { FormField } from "@/types";

/**
 * Hook for managing client-side encryption of skill config secrets.
 *
 * The encryption key is derived from a wallet signature. The user signs
 * a message once per session, and the key is held in memory (never persisted).
 */
export function useEncryption() {
  const [ready, setReady] = useState(false);
  const [signing, setSigning] = useState(false);
  const keyRef = useRef<CryptoKey | null>(null);

  /**
   * Initialize encryption by having the user sign a message.
   * Call this once after wallet connection.
   */
  const initEncryption = useCallback(
    async (signMessage: (message: string) => Promise<string>) => {
      if (keyRef.current) {
        setReady(true);
        return;
      }

      setSigning(true);
      try {
        const signature = await signMessage(ENCRYPTION_SIGN_MESSAGE);
        keyRef.current = await deriveEncryptionKey(signature);
        setReady(true);
      } catch (err) {
        console.error("[encryption] Failed to derive key:", err);
      } finally {
        setSigning(false);
      }
    },
    []
  );

  /**
   * Encrypt secret fields in a config before sending to API.
   */
  const encryptConfig = useCallback(
    async (fields: FormField[], config: Record<string, unknown>) => {
      if (!keyRef.current) {
        throw new Error("Encryption not initialized. Call initEncryption first.");
      }
      return encryptSecretFields(fields, config, keyRef.current);
    },
    []
  );

  /**
   * Decrypt secret fields in a config received from API.
   */
  const decryptConfig = useCallback(
    async (fields: FormField[], config: Record<string, unknown>) => {
      if (!keyRef.current) {
        throw new Error("Encryption not initialized. Call initEncryption first.");
      }
      return decryptSecretFields(fields, config, keyRef.current);
    },
    []
  );

  return {
    ready,
    signing,
    initEncryption,
    encryptConfig,
    decryptConfig,
  };
}

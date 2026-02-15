import { SiweMessage } from "siwe";

/**
 * Create a SIWE message for the user to sign.
 */
export function createSiweMessage(
  address: string,
  nonce: string,
  chainId: number = 8453 // Base
): SiweMessage {
  return new SiweMessage({
    domain: typeof window !== "undefined" ? window.location.host : "clawsight.app",
    address,
    statement: "Sign in to ClawSight to manage your OpenClaw agent.",
    uri: typeof window !== "undefined" ? window.location.origin : "https://clawsight.app",
    version: "1",
    chainId,
    nonce,
  });
}

/**
 * Generate a random nonce for SIWE.
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

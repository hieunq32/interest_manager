import type { JsonValue } from "../shared/json";
import { base64ToBytes, bytesToBase64, bytesToText, textToBytes } from "./encoding";

export type EncryptedPayload = {
  salt: string;
  iv: string;
  data: string;
};

const DEFAULT_ITERATIONS = 250000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", toArrayBuffer(textToBytes(passphrase)), "PBKDF2", false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJsonPayload(input: {
  value: JsonValue;
  passphrase: string;
  iterations?: number;
}): Promise<EncryptedPayload> {
  const iterations = input.iterations ?? DEFAULT_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(input.passphrase, salt, iterations);
  const plaintext = textToBytes(JSON.stringify(input.value));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(plaintext)),
  );

  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(encrypted),
  };
}

export async function decryptJsonPayload<T extends JsonValue>(input: {
  payload: EncryptedPayload;
  passphrase: string;
  iterations?: number;
}): Promise<T> {
  const iterations = input.iterations ?? DEFAULT_ITERATIONS;
  const salt = base64ToBytes(input.payload.salt);
  const iv = base64ToBytes(input.payload.iv);
  const key = await deriveKey(input.passphrase, salt, iterations);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(base64ToBytes(input.payload.data)),
    );
    return JSON.parse(bytesToText(new Uint8Array(decrypted))) as T;
  } catch {
    throw new Error("Unable to decrypt backup payload");
  }
}

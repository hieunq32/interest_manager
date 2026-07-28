import { describe, expect, it } from "vitest";
import type { JsonValue } from "../shared/json";
import { base64ToBytes, bytesToBase64 } from "./encoding";
import { decryptJsonPayload, encryptJsonPayload } from "./encryption";

describe("base64 byte encoding", () => {
  it("round-trips byte arrays without changing byte order", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);

    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual([0, 1, 2, 253, 254, 255]);
  });
});

describe("encrypted JSON payloads", () => {
  it("decrypts to the original JSON value with the same passphrase", async () => {
    const value: JsonValue = {
      schemaVersion: 1,
      records: [{ id: "record-1", amount: 1500000, active: true }],
    };

    const encrypted = await encryptJsonPayload({
      value,
      passphrase: "correct horse battery staple",
      iterations: 1000,
    });
    const decrypted = await decryptJsonPayload<typeof value>({
      payload: encrypted,
      passphrase: "correct horse battery staple",
      iterations: 1000,
    });

    expect(decrypted).toEqual(value);
    expect(encrypted.data).not.toContain("record-1");
  });

  it("rejects the wrong passphrase", async () => {
    const encrypted = await encryptJsonPayload({
      value: { schemaVersion: 1, records: [] },
      passphrase: "right passphrase",
      iterations: 1000,
    });

    await expect(
      decryptJsonPayload({ payload: encrypted, passphrase: "wrong passphrase", iterations: 1000 }),
    ).rejects.toThrow("Unable to decrypt backup payload");
  });
});

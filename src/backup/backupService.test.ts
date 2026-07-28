import { describe, expect, it } from "vitest";
import type { GenericRecord } from "./types";
import { createEncryptedBackup, restoreEncryptedBackup } from "./backupService";

const records: GenericRecord[] = [
  {
    id: "smoke-record",
    type: "system.smoke",
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    data: { note: "Storage smoke record" },
  },
];

describe("backup service", () => {
  it("creates a versioned encrypted backup envelope", async () => {
    const backup = await createEncryptedBackup(records, "safe passphrase", {
      now: new Date("2026-07-28T12:00:00.000Z"),
      iterations: 1000,
    });

    expect(backup).toMatchObject({
      format: "interest-manager-backup",
      version: 1,
      createdAt: "2026-07-28T12:00:00.000Z",
      cipher: {
        name: "AES-GCM",
        kdf: "PBKDF2",
        iterations: 1000,
      },
    });
    expect(backup.payload.data).not.toContain("smoke-record");
  });

  it("restores records from a backup made with the same passphrase", async () => {
    const backup = await createEncryptedBackup(records, "safe passphrase", { iterations: 1000 });

    const restored = await restoreEncryptedBackup(backup, "safe passphrase");

    expect(restored.schemaVersion).toBe(1);
    expect(restored.records).toEqual(records);
  });

  it("rejects unsupported backup versions before decrypting", async () => {
    const backup = await createEncryptedBackup(records, "safe passphrase", { iterations: 1000 });

    await expect(restoreEncryptedBackup({ ...backup, version: 99 }, "safe passphrase")).rejects.toMatchObject({
      code: "unsupported-backup-version",
    });
  });

  it("rejects malformed backup files", async () => {
    await expect(restoreEncryptedBackup({ format: "wrong" }, "safe passphrase")).rejects.toMatchObject({
      code: "invalid-backup",
    });
  });
});

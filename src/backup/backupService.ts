import { decryptJsonPayload, encryptJsonPayload } from "../crypto/encryption";
import { AppError } from "../shared/errors";
import type { JsonValue } from "../shared/json";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  PLAIN_SCHEMA_VERSION,
  type BackupFile,
  type GenericRecord,
  type PlainBackupPayload,
} from "./types";

const DEFAULT_ITERATIONS = 250000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEncryptedPayload(value: unknown): value is BackupFile["payload"] {
  return (
    isObject(value) &&
    typeof value.salt === "string" &&
    typeof value.iv === "string" &&
    typeof value.data === "string"
  );
}

function readBackupFile(value: unknown): BackupFile {
  if (!isObject(value) || value.format !== BACKUP_FORMAT) {
    throw new AppError("invalid-backup", "Invalid backup file");
  }

  if (value.version !== BACKUP_VERSION) {
    throw new AppError("unsupported-backup-version", "Unsupported backup version");
  }

  const cipher = value.cipher;
  if (
    !isObject(cipher) ||
    cipher.name !== "AES-GCM" ||
    cipher.kdf !== "PBKDF2" ||
    typeof cipher.iterations !== "number" ||
    !isEncryptedPayload(value.payload) ||
    typeof value.createdAt !== "string"
  ) {
    throw new AppError("invalid-backup", "Invalid backup file");
  }

  return value as BackupFile;
}

function isGenericRecord(value: unknown): value is GenericRecord {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    "data" in value
  );
}

function readPlainPayload(value: JsonValue): PlainBackupPayload {
  if (!isObject(value) || value.schemaVersion !== PLAIN_SCHEMA_VERSION || !Array.isArray(value.records)) {
    throw new AppError("invalid-backup", "Invalid backup payload");
  }

  if (!value.records.every(isGenericRecord)) {
    throw new AppError("invalid-backup", "Invalid backup records");
  }

  return value as PlainBackupPayload;
}

export async function createEncryptedBackup(
  records: GenericRecord[],
  passphrase: string,
  options: { now?: Date; iterations?: number } = {},
): Promise<BackupFile> {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const createdAt = (options.now ?? new Date()).toISOString();
  const plainPayload: PlainBackupPayload = {
    schemaVersion: PLAIN_SCHEMA_VERSION,
    exportedAt: createdAt,
    records,
  };

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt,
    cipher: {
      name: "AES-GCM",
      kdf: "PBKDF2",
      iterations,
    },
    payload: await encryptJsonPayload({ value: plainPayload, passphrase, iterations }),
  };
}

export async function restoreEncryptedBackup(file: unknown, passphrase: string): Promise<PlainBackupPayload> {
  const backup = readBackupFile(file);

  try {
    const decrypted = await decryptJsonPayload<JsonValue>({
      payload: backup.payload,
      passphrase,
      iterations: backup.cipher.iterations,
    });
    return readPlainPayload(decrypted);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("decrypt-failed", "Unable to decrypt backup payload");
  }
}

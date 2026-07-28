import type { EncryptedPayload } from "../crypto/encryption";
import type { JsonValue } from "../shared/json";

export const BACKUP_FORMAT = "interest-manager-backup";
export const BACKUP_VERSION = 1;
export const PLAIN_SCHEMA_VERSION = 1;

export type GenericRecord = {
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  data: JsonValue;
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  cipher: {
    name: "AES-GCM";
    kdf: "PBKDF2";
    iterations: number;
  };
  payload: EncryptedPayload;
};

export type PlainBackupPayload = {
  schemaVersion: typeof PLAIN_SCHEMA_VERSION;
  exportedAt: string;
  records: GenericRecord[];
};

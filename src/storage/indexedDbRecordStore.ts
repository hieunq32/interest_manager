import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { GenericRecord } from "../backup/types";
import { AppError } from "../shared/errors";
import type { StorageHealth } from "./types";

const STORE_NAME = "records";
const DEFAULT_DB_NAME = "interest-manager";
const DB_VERSION = 1;

interface InterestManagerDb extends DBSchema {
  records: {
    key: string;
    value: GenericRecord;
    indexes: {
      "by-type": string;
    };
  };
}

export class IndexedDbRecordStore {
  private dbPromise?: Promise<IDBPDatabase<InterestManagerDb>>;

  constructor(private readonly dbName = DEFAULT_DB_NAME) {}

  async listRecords(): Promise<GenericRecord[]> {
    const db = await this.open();
    const records = await db.getAll(STORE_NAME);
    return records.sort((left, right) => left.id.localeCompare(right.id));
  }

  async listRecordsByType(type: string): Promise<GenericRecord[]> {
    const db = await this.open();
    const records = await db.getAllFromIndex(STORE_NAME, "by-type", type);
    return records.sort((left, right) => left.id.localeCompare(right.id));
  }

  async upsertRecord(record: GenericRecord): Promise<void> {
    const db = await this.open();
    await db.put(STORE_NAME, record);
  }

  async upsertRecords(records: GenericRecord[]): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    for (const record of records) {
      await transaction.store.put(record);
    }
    await transaction.done;
  }

  async deleteRecord(id: string): Promise<void> {
    const db = await this.open();
    await db.delete(STORE_NAME, id);
  }

  async replaceRecords(records: GenericRecord[]): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    await transaction.store.clear();
    for (const record of records) {
      await transaction.store.put(record);
    }
    await transaction.done;
  }

  async clearRecords(): Promise<void> {
    const db = await this.open();
    await db.clear(STORE_NAME);
  }

  async getHealth(): Promise<StorageHealth> {
    try {
      return {
        available: true,
        recordCount: (await this.listRecords()).length,
        message: "Storage ready",
      };
    } catch {
      return {
        available: false,
        recordCount: 0,
        message: "Storage unavailable",
      };
    }
  }

  private async open(): Promise<IDBPDatabase<InterestManagerDb>> {
    if (!("indexedDB" in globalThis)) {
      throw new AppError("storage-unavailable", "IndexedDB is unavailable");
    }

    this.dbPromise ??= openDB<InterestManagerDb>(this.dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("by-type", "type");
        }
      },
    });

    return this.dbPromise;
  }
}

import { describe, expect, it } from "vitest";
import type { GenericRecord } from "../backup/types";
import { IndexedDbRecordStore } from "./indexedDbRecordStore";

let dbCounter = 0;

function createStore(): IndexedDbRecordStore {
  dbCounter += 1;
  return new IndexedDbRecordStore(`interest-manager-test-${dbCounter}`);
}

const firstRecord: GenericRecord = {
  id: "record-1",
  type: "system.smoke",
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T00:00:00.000Z",
  data: { note: "first" },
};

const secondRecord: GenericRecord = {
  id: "record-2",
  type: "system.smoke",
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T01:00:00.000Z",
  data: { note: "second" },
};

describe("IndexedDbRecordStore", () => {
  it("creates and lists records in insertion-independent id order", async () => {
    const store = createStore();

    await store.upsertRecord(secondRecord);
    await store.upsertRecord(firstRecord);

    expect(await store.listRecords()).toEqual([firstRecord, secondRecord]);
  });

  it("replaces all records atomically for restore", async () => {
    const store = createStore();
    await store.upsertRecord(firstRecord);

    await store.replaceRecords([secondRecord]);

    expect(await store.listRecords()).toEqual([secondRecord]);
  });

  it("lists indexed types, writes batches, and deletes individual records", async () => {
    const store = createStore();
    const otherTypeRecord: GenericRecord = {
      ...secondRecord,
      id: "record-3",
      type: "system.other",
    };

    await store.upsertRecords([secondRecord, firstRecord, otherTypeRecord]);

    await expect(store.listRecordsByType("system.smoke")).resolves.toEqual([firstRecord, secondRecord]);
    await store.deleteRecord(secondRecord.id);

    await expect(store.listRecords()).resolves.toEqual([firstRecord, otherTypeRecord]);
  });

  it("reports storage health with record count", async () => {
    const store = createStore();
    await store.upsertRecord(firstRecord);

    await expect(store.getHealth()).resolves.toEqual({
      available: true,
      recordCount: 1,
      message: "Storage ready",
    });
  });
});

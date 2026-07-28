import type { GenericRecord } from "../../backup/types";
import { IndexedDbRecordStore } from "../../storage/indexedDbRecordStore";
import type {
  Borrower,
  Loan,
  PaymentTransaction,
  PromiseToPay,
  ReminderSettings,
  ScheduleEntry,
  ScheduleVersion,
} from "../domain/types";
import {
  LENDING_RECORD_TYPES,
  LENDING_REMINDER_SETTINGS_RECORD_ID,
  type LendingDomainRecord,
  type LendingRecordData,
  type LendingRecordType,
  isLendingRecordType,
} from "./recordTypes";

export interface LendingRepository {
  listBorrowers(): Promise<Borrower[]>;
  saveBorrower(value: Borrower): Promise<void>;
  listLoans(borrowerId?: string): Promise<Loan[]>;
  saveLoan(value: Loan): Promise<void>;
  listScheduleVersions(loanId?: string): Promise<ScheduleVersion[]>;
  saveScheduleVersion(value: ScheduleVersion): Promise<void>;
  listScheduleEntries(scheduleVersionId?: string): Promise<ScheduleEntry[]>;
  saveScheduleEntries(values: ScheduleEntry[]): Promise<void>;
  listPayments(loanId?: string): Promise<PaymentTransaction[]>;
  savePayment(value: PaymentTransaction): Promise<void>;
  listPromises(loanId?: string): Promise<PromiseToPay[]>;
  savePromise(value: PromiseToPay): Promise<void>;
  getReminderSettings(): Promise<ReminderSettings | undefined>;
  saveReminderSettings(value: ReminderSettings): Promise<void>;
  listAllDomainRecords(): Promise<GenericRecord[]>;
  replaceAllDomainRecords(values: GenericRecord[]): Promise<void>;
}

type AuditedLendingValue = Exclude<LendingRecordData[LendingRecordType], ReminderSettings>;

function toGenericRecord<T extends LendingRecordType>(
  type: T,
  value: LendingRecordData[T] & AuditedLendingValue,
): GenericRecord {
  const updatedAt = "updatedAt" in value ? value.updatedAt : value.createdAt;
  const record = {
    id: value.id,
    type,
    createdAt: value.createdAt,
    updatedAt,
    data: value,
  } as LendingDomainRecord<T>;
  return record as unknown as GenericRecord;
}

export class IndexedDbLendingRepository implements LendingRepository {
  constructor(private readonly store: IndexedDbRecordStore) {}

  async listBorrowers(): Promise<Borrower[]> {
    return this.listData(LENDING_RECORD_TYPES.borrower);
  }

  async saveBorrower(value: Borrower): Promise<void> {
    await this.store.upsertRecord(toGenericRecord(LENDING_RECORD_TYPES.borrower, value));
  }

  async listLoans(borrowerId?: string): Promise<Loan[]> {
    const values = await this.listData(LENDING_RECORD_TYPES.loan);
    return borrowerId === undefined ? values : values.filter((value) => value.borrowerId === borrowerId);
  }

  async saveLoan(value: Loan): Promise<void> {
    await this.store.upsertRecord(toGenericRecord(LENDING_RECORD_TYPES.loan, value));
  }

  async listScheduleVersions(loanId?: string): Promise<ScheduleVersion[]> {
    const values = await this.listData(LENDING_RECORD_TYPES.scheduleVersion);
    return loanId === undefined ? values : values.filter((value) => value.loanId === loanId);
  }

  async saveScheduleVersion(value: ScheduleVersion): Promise<void> {
    await this.store.upsertRecord(toGenericRecord(LENDING_RECORD_TYPES.scheduleVersion, value));
  }

  async listScheduleEntries(scheduleVersionId?: string): Promise<ScheduleEntry[]> {
    const values = await this.listData(LENDING_RECORD_TYPES.scheduleEntry);
    return scheduleVersionId === undefined
      ? values
      : values.filter((value) => value.scheduleVersionId === scheduleVersionId);
  }

  async saveScheduleEntries(values: ScheduleEntry[]): Promise<void> {
    await this.store.upsertRecords(
      values.map((value) => toGenericRecord(LENDING_RECORD_TYPES.scheduleEntry, value)),
    );
  }

  async listPayments(loanId?: string): Promise<PaymentTransaction[]> {
    const values = await this.listData(LENDING_RECORD_TYPES.payment);
    return loanId === undefined ? values : values.filter((value) => value.loanId === loanId);
  }

  async savePayment(value: PaymentTransaction): Promise<void> {
    await this.store.upsertRecord(toGenericRecord(LENDING_RECORD_TYPES.payment, value));
  }

  async listPromises(loanId?: string): Promise<PromiseToPay[]> {
    const values = await this.listData(LENDING_RECORD_TYPES.promise);
    return loanId === undefined ? values : values.filter((value) => value.loanId === loanId);
  }

  async savePromise(value: PromiseToPay): Promise<void> {
    await this.store.upsertRecord(toGenericRecord(LENDING_RECORD_TYPES.promise, value));
  }

  async getReminderSettings(): Promise<ReminderSettings | undefined> {
    const records = await this.store.listRecordsByType(LENDING_RECORD_TYPES.reminderSettings);
    const record = records.find((candidate) => candidate.id === LENDING_REMINDER_SETTINGS_RECORD_ID);
    return record?.data as ReminderSettings | undefined;
  }

  async saveReminderSettings(value: ReminderSettings): Promise<void> {
    const existingRecords = await this.store.listRecordsByType(LENDING_RECORD_TYPES.reminderSettings);
    const existing = existingRecords.find((candidate) => candidate.id === LENDING_REMINDER_SETTINGS_RECORD_ID);
    const now = new Date().toISOString();

    await this.store.upsertRecord({
      id: LENDING_REMINDER_SETTINGS_RECORD_ID,
      type: LENDING_RECORD_TYPES.reminderSettings,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      data: value as unknown as GenericRecord["data"],
    });
  }

  async listAllDomainRecords(): Promise<GenericRecord[]> {
    const records = await this.store.listRecords();
    return records.filter((record) => isLendingRecordType(record.type));
  }

  async replaceAllDomainRecords(values: GenericRecord[]): Promise<void> {
    const existingRecords = await this.store.listRecords();
    const nonDomainRecords = existingRecords.filter((record) => !isLendingRecordType(record.type));
    const domainRecords = values.filter((record) => isLendingRecordType(record.type));
    await this.store.replaceRecords([...nonDomainRecords, ...domainRecords]);
  }

  private async listData<T extends LendingRecordType>(type: T): Promise<LendingRecordData[T][]> {
    const records = await this.store.listRecordsByType(type);
    return records.map((record) => record.data as unknown as LendingRecordData[T]);
  }
}

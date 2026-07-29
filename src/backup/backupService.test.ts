import { describe, expect, it } from "vitest";
import type {
  Borrower,
  Loan,
  LoanLifecycleEvent,
  PaymentAdjustment,
  PaymentTransaction,
  PromiseToPay,
  ReminderSettings,
  ScheduleEntry,
  ScheduleVersion,
} from "../lending/domain/types";
import { IndexedDbLendingRepository } from "../lending/storage/lendingRepository";
import { LENDING_RECORD_TYPES } from "../lending/storage/recordTypes";
import { IndexedDbRecordStore } from "../storage/indexedDbRecordStore";
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

  it("restores every lending domain record into a clean repository", async () => {
    const source = createLendingRepository();
    const domainRecords = await saveLendingHistory(source);
    const backup = await createEncryptedBackup(domainRecords, "safe passphrase", { iterations: 1000 });
    const restored = await restoreEncryptedBackup(backup, "safe passphrase");
    const target = createLendingRepository();

    await target.replaceAllDomainRecords(restored.records);

    await expect(target.listAllDomainRecords()).resolves.toEqual(domainRecords);
    expect(new Set(domainRecords.map((record) => record.type))).toEqual(new Set(Object.values(LENDING_RECORD_TYPES)));
  });
});

let lendingDbCounter = 0;

function createLendingRepository(): IndexedDbLendingRepository {
  lendingDbCounter += 1;
  return new IndexedDbLendingRepository(new IndexedDbRecordStore(`backup-lending-test-${lendingDbCounter}`));
}

async function saveLendingHistory(repository: IndexedDbLendingRepository): Promise<GenericRecord[]> {
  const createdAt = "2026-07-28T00:00:00.000Z";
  const updatedAt = "2026-07-28T01:00:00.000Z";
  const borrower: Borrower = {
    id: "borrower-1",
    displayName: "Nguyen Van A",
    status: "active",
    createdAt,
    updatedAt,
  };
  const loan: Loan = {
    id: "loan-1",
    borrowerId: borrower.id,
    calculationModel: "equal-principal-flat-interest",
    originalPrincipal: 10_000_000,
    disbursementDate: "2026-06-20",
    monthlyDueDay: 5,
    maturityDate: "2026-12-15",
    rateValue: 0.02,
    rateUnit: "monthly",
    partialPeriodInterestMode: "full-period",
    defaultScheduleVersionId: "version-1",
    status: "active",
    createdAt,
    updatedAt,
  };
  const version: ScheduleVersion = {
    id: "version-1",
    loanId: loan.id,
    versionNumber: 1,
    effectiveDate: "2026-06-20",
    calculationModel: loan.calculationModel,
    principalBase: loan.originalPrincipal,
    disbursementDate: loan.disbursementDate,
    monthlyDueDay: loan.monthlyDueDay,
    maturityDate: loan.maturityDate,
    rateValue: loan.rateValue,
    rateUnit: loan.rateUnit,
    partialPeriodInterestMode: loan.partialPeriodInterestMode,
    createdAt,
  };
  const entry: ScheduleEntry = {
    id: "entry-1",
    scheduleVersionId: version.id,
    periodStart: "2026-06-20",
    dueDate: "2026-07-05",
    expectedPrincipal: 1_666_666,
    expectedInterest: 200_000,
    status: "upcoming",
    createdAt,
    updatedAt,
  };
  const payment: PaymentTransaction = {
    id: "payment-1",
    loanId: loan.id,
    scheduleEntryId: entry.id,
    receivedAt: "2026-07-05",
    principalAmount: 1_000_000,
    interestAmount: 200_000,
    createdAt,
    status: "adjusted",
    updatedAt,
  };
  const replacementPayment: PaymentTransaction = {
    ...payment,
    id: "payment-2",
    principalAmount: 900_000,
    status: "active",
    createdAt: updatedAt,
    updatedAt,
  };
  const paymentAdjustment: PaymentAdjustment = {
    id: "payment-adjustment-1",
    loanId: loan.id,
    paymentId: payment.id,
    replacementPaymentId: replacementPayment.id,
    action: "edit",
    reason: "Correct principal amount",
    before: {
      scheduleEntryId: entry.id,
      receivedAt: payment.receivedAt,
      principalAmount: 1_000_000,
      interestAmount: 200_000,
    },
    after: {
      scheduleEntryId: entry.id,
      receivedAt: replacementPayment.receivedAt,
      principalAmount: replacementPayment.principalAmount,
      interestAmount: replacementPayment.interestAmount,
    },
    createdAt: updatedAt,
  };
  const lifecycleEvent: LoanLifecycleEvent = {
    id: "loan-lifecycle-event-1",
    loanId: loan.id,
    action: "settled",
    effectiveDate: "2026-07-28",
    reason: "Balance cleared",
    createdAt: updatedAt,
  };
  const promise: PromiseToPay = {
    id: "promise-1",
    loanId: loan.id,
    scheduleEntryId: entry.id,
    promisedDate: "2026-07-10",
    note: "Pay after salary day",
    status: "open",
    createdAt,
    updatedAt,
  };
  const settings: ReminderSettings = {
    enabled: true,
    offsetDays: 1,
    time: "08:00",
  };

  await repository.saveBorrower(borrower);
  await repository.saveLoan(loan);
  await repository.saveScheduleVersion(version);
  await repository.saveScheduleEntries([entry]);
  await repository.savePaymentCorrection({
    original: payment,
    replacement: replacementPayment,
    adjustment: paymentAdjustment,
  });
  await repository.saveLoanLifecycleMutation({
    loan: { ...loan, status: "settled", updatedAt },
    event: lifecycleEvent,
  });
  await repository.savePromise(promise);
  await repository.saveReminderSettings(settings);

  const domainRecords = await repository.listAllDomainRecords();
  expect(domainRecords).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: LENDING_RECORD_TYPES.payment, data: payment }),
    expect.objectContaining({ type: LENDING_RECORD_TYPES.payment, data: replacementPayment }),
    expect.objectContaining({ type: LENDING_RECORD_TYPES.paymentAdjustment, data: paymentAdjustment }),
    expect.objectContaining({ type: LENDING_RECORD_TYPES.loanLifecycleEvent, data: lifecycleEvent }),
  ]));
  return domainRecords;
}

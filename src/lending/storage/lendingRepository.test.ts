import { describe, expect, it, vi } from "vitest";
import type { GenericRecord } from "../../backup/types";
import type {
  Borrower,
  Loan,
  LoanLifecycleEvent,
  PaymentAdjustment,
  PaymentCancellationMutation,
  PaymentCorrectionMutation,
  PaymentTransaction,
  PromiseToPay,
  ReminderSettings,
  ScheduleEntry,
  ScheduleVersion,
} from "../domain/types";
import { IndexedDbRecordStore } from "../../storage/indexedDbRecordStore";
import { IndexedDbLendingRepository } from "./lendingRepository";
import { isLendingRecordType } from "./recordTypes";

let dbCounter = 0;

function createRepository(): IndexedDbLendingRepository {
  dbCounter += 1;
  return new IndexedDbLendingRepository(new IndexedDbRecordStore(`lending-repository-test-${dbCounter}`));
}

const createdAt = "2026-07-28T00:00:00.000Z";
const updatedAt = "2026-07-28T01:00:00.000Z";

const borrower: Borrower = {
  id: "borrower-1",
  displayName: "Nguyen Van A",
  phone: "0900000000",
  status: "active",
  createdAt,
  updatedAt,
};

const secondBorrower: Borrower = {
  ...borrower,
  id: "borrower-2",
  displayName: "Tran Thi B",
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

const secondLoan: Loan = {
  ...loan,
  id: "loan-2",
  borrowerId: secondBorrower.id,
  defaultScheduleVersionId: "version-2",
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

const secondVersion: ScheduleVersion = {
  ...version,
  id: "version-2",
  loanId: secondLoan.id,
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

const secondEntry: ScheduleEntry = {
  ...entry,
  id: "entry-2",
  dueDate: "2026-08-05",
};

const thirdEntry: ScheduleEntry = {
  ...entry,
  id: "entry-3",
  scheduleVersionId: secondVersion.id,
};

const payment: PaymentTransaction = {
  id: "payment-1",
  loanId: loan.id,
  scheduleEntryId: entry.id,
  receivedAt: "2026-07-05",
  principalAmount: 1_000_000,
  interestAmount: 200_000,
  createdAt,
};

const secondPayment: PaymentTransaction = {
  ...payment,
  id: "payment-2",
  loanId: secondLoan.id,
  scheduleEntryId: thirdEntry.id,
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

const secondPromise: PromiseToPay = {
  ...promise,
  id: "promise-2",
  loanId: secondLoan.id,
  scheduleEntryId: thirdEntry.id,
};

const reminderSettings: ReminderSettings = {
  enabled: true,
  offsetDays: 1,
  time: "08:00",
};

describe("IndexedDbLendingRepository", () => {
  it("round trips every lending type and filters records by their parent ids", async () => {
    const repository = createRepository();

    await repository.saveBorrower(secondBorrower);
    await repository.saveBorrower(borrower);
    await repository.saveLoan(secondLoan);
    await repository.saveLoan(loan);
    await repository.saveScheduleVersion(secondVersion);
    await repository.saveScheduleVersion(version);
    await repository.saveScheduleEntries([thirdEntry, secondEntry, entry]);
    await repository.savePayment(secondPayment);
    await repository.savePayment(payment);
    await repository.savePromise(secondPromise);
    await repository.savePromise(promise);
    await repository.saveReminderSettings(reminderSettings);

    await expect(repository.listBorrowers()).resolves.toEqual([borrower, secondBorrower]);
    await expect(repository.listLoans(borrower.id)).resolves.toEqual([loan]);
    await expect(repository.listLoans()).resolves.toEqual([loan, secondLoan]);
    await expect(repository.listScheduleVersions(loan.id)).resolves.toEqual([version]);
    await expect(repository.listScheduleEntries(version.id)).resolves.toEqual([entry, secondEntry]);
    await expect(repository.listPayments(loan.id)).resolves.toEqual([
      { ...payment, status: "active", updatedAt: payment.createdAt },
    ]);
    await expect(repository.listPromises(loan.id)).resolves.toEqual([promise]);
    await expect(repository.getReminderSettings()).resolves.toEqual(reminderSettings);
  });

  it("persists schedule-entry batches and replaces repeated record ids", async () => {
    const repository = createRepository();
    const replacementEntry: ScheduleEntry = {
      ...entry,
      expectedPrincipal: 1_666_667,
      status: "partially-paid",
      updatedAt: "2026-07-28T02:00:00.000Z",
    };

    await repository.saveScheduleEntries([entry, secondEntry]);
    await expect(repository.listScheduleEntries(version.id)).resolves.toEqual([entry, secondEntry]);

    await repository.saveScheduleEntries([replacementEntry]);

    await expect(repository.listScheduleEntries(version.id)).resolves.toEqual([replacementEntry, secondEntry]);
  });

  it("recognizes payment audit record types and normalizes legacy active payments", async () => {
    const store = new IndexedDbRecordStore(`lending-repository-test-${++dbCounter}`);
    const repository = new IndexedDbLendingRepository(store);

    await store.upsertRecord({
      id: payment.id,
      type: "lending.payment",
      createdAt,
      updatedAt: createdAt,
      data: payment as unknown as GenericRecord["data"],
    });

    expect(isLendingRecordType("lending.payment-adjustment")).toBe(true);
    expect(isLendingRecordType("lending.loan-lifecycle-event")).toBe(true);
    await expect(repository.listPayments(loan.id)).resolves.toEqual([
      { ...payment, status: "active", updatedAt: createdAt },
    ]);
    await expect(repository.listPaymentHistory(loan.id)).resolves.toEqual([
      { ...payment, status: "active", updatedAt: createdAt },
    ]);
  });

  it("atomically persists a payment correction and invalidates its calendar export", async () => {
    const store = new IndexedDbRecordStore(`lending-repository-test-${++dbCounter}`);
    const repository = new IndexedDbLendingRepository(store);
    const mutation: PaymentCorrectionMutation = {
      original: { ...payment, status: "adjusted", updatedAt: "2026-07-28T02:00:00.000Z" },
      replacement: {
        ...payment,
        id: "payment-1-replacement",
        principalAmount: 900_000,
        status: "active",
        createdAt: "2026-07-28T02:00:00.000Z",
        updatedAt: "2026-07-28T02:00:00.000Z",
      },
      adjustment: {
        id: "payment-adjustment-1",
        loanId: loan.id,
        paymentId: payment.id,
        replacementPaymentId: "payment-1-replacement",
        action: "edit",
        reason: "Correct principal amount",
        before: {
          scheduleEntryId: entry.id,
          receivedAt: payment.receivedAt,
          principalAmount: payment.principalAmount,
          interestAmount: payment.interestAmount,
        },
        after: {
          scheduleEntryId: entry.id,
          receivedAt: payment.receivedAt,
          principalAmount: 900_000,
          interestAmount: payment.interestAmount,
        },
        createdAt: "2026-07-28T02:00:00.000Z",
      },
    };

    await repository.savePayment(payment);
    await repository.saveLoan({ ...loan, calendarExportVersionId: version.id });
    const upsertRecords = vi.spyOn(store, "upsertRecords");

    await repository.savePaymentCorrection(mutation);

    expect(upsertRecords).toHaveBeenCalledTimes(1);
    expect(upsertRecords).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ type: "lending.payment", data: mutation.original }),
      expect.objectContaining({ type: "lending.payment", data: mutation.replacement }),
      expect.objectContaining({ type: "lending.payment-adjustment", data: mutation.adjustment }),
      expect.objectContaining({ type: "lending.loan" }),
    ]));
    await expect(repository.listPayments(loan.id)).resolves.toEqual([mutation.replacement]);
    await expect(repository.listPaymentHistory(loan.id)).resolves.toEqual([
      mutation.original,
      mutation.replacement,
    ]);
    await expect(repository.listPaymentAdjustments(loan.id)).resolves.toEqual([mutation.adjustment]);
    await expect(repository.listLoans(loan.borrowerId)).resolves.toEqual([
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
    ]);
  });

  it("atomically voids a payment while retaining it in payment history", async () => {
    const store = new IndexedDbRecordStore(`lending-repository-test-${++dbCounter}`);
    const repository = new IndexedDbLendingRepository(store);
    const otherPayment: PaymentTransaction = {
      ...payment,
      id: "payment-2",
      status: "active",
      updatedAt: "2026-07-28T01:30:00.000Z",
    };
    const mutation: PaymentCancellationMutation = {
      original: { ...payment, status: "voided", updatedAt: "2026-07-28T02:00:00.000Z" },
      adjustment: {
        id: "payment-adjustment-2",
        loanId: loan.id,
        paymentId: payment.id,
        action: "void",
        reason: "Duplicate receipt",
        before: {
          scheduleEntryId: entry.id,
          receivedAt: payment.receivedAt,
          principalAmount: payment.principalAmount,
          interestAmount: payment.interestAmount,
        },
        createdAt: "2026-07-28T02:00:00.000Z",
      },
    };

    await repository.savePayment(payment);
    await repository.savePayment(otherPayment);
    await repository.saveLoan({ ...loan, calendarExportVersionId: version.id });
    const upsertRecords = vi.spyOn(store, "upsertRecords");

    await repository.savePaymentCancellation(mutation);

    expect(upsertRecords).toHaveBeenCalledTimes(1);
    expect(upsertRecords).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ type: "lending.payment", data: mutation.original }),
      expect.objectContaining({ type: "lending.payment-adjustment", data: mutation.adjustment }),
      expect.objectContaining({ type: "lending.loan" }),
    ]));
    await expect(repository.listPayments(loan.id)).resolves.toEqual([otherPayment]);
    await expect(repository.listPaymentHistory(loan.id)).resolves.toEqual([
      mutation.original,
      otherPayment,
    ]);
    await expect(repository.listPaymentAdjustments(loan.id)).resolves.toEqual([mutation.adjustment]);
    await expect(repository.listLoans(loan.borrowerId)).resolves.toEqual([
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
    ]);
  });

  it("persists loan lifecycle mutations as one batch", async () => {
    const store = new IndexedDbRecordStore(`lending-repository-test-${++dbCounter}`);
    const repository = new IndexedDbLendingRepository(store);
    const settledLoan: Loan = { ...loan, status: "settled", updatedAt: "2026-07-28T02:00:00.000Z" };
    const event: LoanLifecycleEvent = {
      id: "loan-lifecycle-event-1",
      loanId: loan.id,
      action: "settled",
      effectiveDate: "2026-07-28",
      reason: "Balance cleared",
      createdAt: "2026-07-28T02:00:00.000Z",
    };
    const upsertRecords = vi.spyOn(store, "upsertRecords");

    await repository.saveLoanLifecycleMutation({ loan: settledLoan, event });

    expect(upsertRecords).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ type: "lending.loan", data: settledLoan }),
      expect.objectContaining({ type: "lending.loan-lifecycle-event", data: event }),
    ]));
    await expect(repository.listLoans(loan.borrowerId)).resolves.toEqual([settledLoan]);
    await expect(repository.listLoanLifecycleEvents(loan.id)).resolves.toEqual([event]);
  });

  it("lists lifecycle history chronologically instead of by random record ID", async () => {
    const repository = createRepository();
    const settledEvent: LoanLifecycleEvent = {
      id: "z-settlement",
      loanId: loan.id,
      action: "settled",
      effectiveDate: "2026-07-15",
      createdAt: "2026-07-15T08:00:00.000Z",
    };
    const reopenedEvent: LoanLifecycleEvent = {
      id: "a-reopening",
      loanId: loan.id,
      action: "reopened",
      effectiveDate: "2026-07-16",
      reason: "Correction required",
      createdAt: "2026-07-16T08:00:00.000Z",
    };

    await repository.saveLoanLifecycleMutation({
      loan: { ...loan, status: "settled", settledAt: settledEvent.effectiveDate, updatedAt: settledEvent.createdAt },
      event: settledEvent,
    });
    await repository.saveLoanLifecycleMutation({
      loan: { ...loan, status: "active", updatedAt: reopenedEvent.createdAt },
      event: reopenedEvent,
    });

    await expect(repository.listLoanLifecycleEvents(loan.id)).resolves.toEqual([settledEvent, reopenedEvent]);
  });

  it("rejects a lifecycle event that belongs to another loan", async () => {
    const repository = createRepository();
    const settledLoan: Loan = { ...loan, status: "settled", settledAt: "2026-07-28", updatedAt: "2026-07-28T02:00:00.000Z" };
    const event: LoanLifecycleEvent = {
      id: "loan-lifecycle-event-wrong-loan",
      loanId: "another-loan",
      action: "settled",
      effectiveDate: "2026-07-28",
      createdAt: "2026-07-28T02:00:00.000Z",
    };

    await expect(repository.saveLoanLifecycleMutation({ loan: settledLoan, event }))
      .rejects.toThrow("lifecycle event loan ID must match loan ID");
  });

  it("rejects a lifecycle action that conflicts with the loan status", async () => {
    const repository = createRepository();
    const event: LoanLifecycleEvent = {
      id: "loan-lifecycle-event-wrong-action",
      loanId: loan.id,
      action: "reopened",
      effectiveDate: "2026-07-28",
      createdAt: "2026-07-28T02:00:00.000Z",
    };

    await expect(repository.saveLoanLifecycleMutation({ loan: { ...loan, status: "settled" }, event }))
      .rejects.toThrow("lifecycle event action must match loan status");
  });

  it("clears settled calendar exports and preserves lifecycle events through restore", async () => {
    const source = createRepository();
    const settledLoan: Loan = {
      ...loan,
      status: "settled",
      settledAt: "2026-07-28",
      calendarExportVersionId: version.id,
      updatedAt: "2026-07-28T02:00:00.000Z",
    };
    const event: LoanLifecycleEvent = {
      id: "loan-lifecycle-event-restore",
      loanId: loan.id,
      action: "settled",
      effectiveDate: "2026-07-28",
      createdAt: "2026-07-28T02:00:00.000Z",
    };
    const unrelatedEvent: LoanLifecycleEvent = {
      ...event,
      id: "loan-lifecycle-event-other-loan",
      loanId: "other-loan",
    };

    await source.saveLoanLifecycleMutation({ loan: settledLoan, event });
    await source.saveLoanLifecycleMutation({
      loan: { ...loan, id: "other-loan", status: "settled", settledAt: "2026-07-28" },
      event: unrelatedEvent,
    });

    await expect(source.listLoans(loan.borrowerId)).resolves.toEqual([
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
      expect.objectContaining({ id: "other-loan" }),
    ]);
    await expect(source.listLoanLifecycleEvents(loan.id)).resolves.toEqual([event]);

    const target = createRepository();
    await target.replaceAllDomainRecords(await source.listAllDomainRecords());

    await expect(target.listLoanLifecycleEvents(loan.id)).resolves.toEqual([event]);
  });

  it("saves and replaces a complete loan bundle with one record-store batch", async () => {
    const store = new IndexedDbRecordStore(`lending-repository-test-${++dbCounter}`);
    const repository = new IndexedDbLendingRepository(store);
    const replacementLoan: Loan = { ...loan, note: "Updated onboarding note", updatedAt: "2026-07-28T02:00:00.000Z" };
    const replacementVersion: ScheduleVersion = { ...version, rateValue: 0.025 };
    const replacementEntry: ScheduleEntry = {
      ...entry,
      expectedInterest: 250_000,
      updatedAt: "2026-07-28T02:00:00.000Z",
    };
    const upsertRecords = vi.spyOn(store, "upsertRecords");

    await repository.saveLoanBundle({ loan, version, entries: [entry, secondEntry] });
    await repository.saveLoanBundle({
      loan: replacementLoan,
      version: replacementVersion,
      entries: [replacementEntry, secondEntry],
    });

    expect(upsertRecords).toHaveBeenCalledTimes(2);
    expect(upsertRecords.mock.calls[0][0]).toHaveLength(4);
    await expect(repository.listLoans(loan.borrowerId)).resolves.toEqual([replacementLoan]);
    await expect(repository.listScheduleVersions(loan.id)).resolves.toEqual([replacementVersion]);
    await expect(repository.listScheduleEntries(version.id)).resolves.toEqual([replacementEntry, secondEntry]);
  });

  it("ignores unrelated input records while preserving existing shared-store records during restore", async () => {
    const source = createRepository();
    await source.saveBorrower(borrower);
    const domainRecords = await source.listAllDomainRecords();
    const targetStore = new IndexedDbRecordStore(`lending-repository-test-${++dbCounter}`);
    const target = new IndexedDbLendingRepository(targetStore);
    const existingSharedRecord: GenericRecord = {
      id: "system-record",
      type: "system.smoke",
      createdAt,
      updatedAt,
      data: { origin: "target" },
    };
    const unrelatedInputRecord: GenericRecord = {
      ...existingSharedRecord,
      data: { origin: "backup" },
    };

    await targetStore.upsertRecord(existingSharedRecord);
    await target.replaceAllDomainRecords([...domainRecords, unrelatedInputRecord]);

    await expect(targetStore.listRecords()).resolves.toEqual([...domainRecords, existingSharedRecord]);
  });

  it("invalidates an exported loan calendar when a payment is saved", async () => {
    const repository = createRepository();
    await repository.saveLoan({ ...loan, calendarExportVersionId: version.id });

    await repository.savePayment(payment);

    await expect(repository.listLoans(loan.borrowerId)).resolves.toEqual([
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
    ]);
  });

  it("invalidates an exported loan calendar for promise creation and status updates", async () => {
    const repository = createRepository();
    await repository.saveLoan({ ...loan, calendarExportVersionId: version.id });

    await repository.savePromise(promise);
    await expect(repository.listLoans(loan.borrowerId)).resolves.toEqual([
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
    ]);

    await repository.saveLoan({ ...loan, calendarExportVersionId: version.id });
    await repository.savePromise({ ...promise, status: "fulfilled", updatedAt: "2026-07-29T00:00:00.000Z" });
    await expect(repository.listLoans(loan.borrowerId)).resolves.toEqual([
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
    ]);

    await repository.saveLoan({ ...loan, calendarExportVersionId: version.id });
    await repository.savePromise({ ...promise, status: "cancelled", updatedAt: "2026-07-30T00:00:00.000Z" });
    await expect(repository.listLoans(loan.borrowerId)).resolves.toEqual([
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
    ]);
  });

  it("invalidates every exported loan calendar when global reminder settings change", async () => {
    const repository = createRepository();
    await repository.saveLoan({ ...loan, calendarExportVersionId: version.id });
    await repository.saveLoan({ ...secondLoan, calendarExportVersionId: secondVersion.id });

    await repository.saveReminderSettings({ ...reminderSettings, offsetDays: 2 });

    await expect(repository.listLoans()).resolves.toEqual([
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
    ]);
  });
});

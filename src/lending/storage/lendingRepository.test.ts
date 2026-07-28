import { describe, expect, it } from "vitest";
import type {
  Borrower,
  Loan,
  PaymentTransaction,
  PromiseToPay,
  ReminderSettings,
  ScheduleEntry,
  ScheduleVersion,
} from "../domain/types";
import { IndexedDbRecordStore } from "../../storage/indexedDbRecordStore";
import { IndexedDbLendingRepository } from "./lendingRepository";

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
    await expect(repository.listPayments(loan.id)).resolves.toEqual([payment]);
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
});

import { describe, expect, it } from "vitest";
import {
  filterBorrowers,
  filterLoans,
  getLoanCollectionStatus,
  type LoanCollectionStatus,
} from "./loanSelectors";
import type {
  Borrower,
  Loan,
  PaymentTransaction,
  PromiseToPay,
  ScheduleEntry,
} from "./types";

const TODAY = "2026-07-10";

function borrower(overrides: Partial<Borrower> = {}): Borrower {
  return {
    id: "borrower-1",
    displayName: "Nguyen Van An",
    phone: "0901 234 567",
    status: "active",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "loan-1",
    borrowerId: "borrower-1",
    calculationModel: "equal-principal-flat-interest",
    originalPrincipal: 1_000,
    disbursementDate: "2026-07-01",
    monthlyDueDay: 10,
    maturityDate: "2026-12-10",
    rateValue: 0.02,
    rateUnit: "monthly",
    partialPeriodInterestMode: "full-period",
    defaultScheduleVersionId: "version-1",
    status: "active",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function entry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "entry-1",
    scheduleVersionId: "version-1",
    periodStart: "2026-07-01",
    dueDate: TODAY,
    expectedPrincipal: 1_000,
    expectedInterest: 100,
    status: "upcoming",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function payment(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
  return {
    id: "payment-1",
    loanId: "loan-1",
    scheduleEntryId: "entry-1",
    receivedAt: TODAY,
    principalAmount: 1_000,
    interestAmount: 100,
    createdAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

function promise(overrides: Partial<PromiseToPay> = {}): PromiseToPay {
  return {
    id: "promise-1",
    loanId: "loan-1",
    scheduleEntryId: "entry-1",
    promisedDate: "2026-07-12",
    note: "Will pay shortly",
    status: "open",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("loan collection status", () => {
  const statusCases: Array<[
    string,
    ScheduleEntry[],
    PaymentTransaction[],
    PromiseToPay[],
    LoanCollectionStatus,
  ]> = [
    ["overdue", [entry({ id: "overdue", dueDate: "2026-07-09" }), entry({ id: "due" })], [], [], "overdue"],
    ["due", [entry({ id: "due" }), entry({ id: "promised" })], [], [promise({ scheduleEntryId: "promised" })], "due"],
    ["promised", [entry({ id: "promised" }), entry({ id: "paid" })], [payment({ scheduleEntryId: "paid" })], [promise({ scheduleEntryId: "promised" })], "promised"],
    ["paid", [entry({ id: "paid" }), entry({ id: "upcoming", dueDate: "2026-08-10" })], [payment({ scheduleEntryId: "paid" })], [], "paid"],
    ["upcoming", [entry({ id: "upcoming", dueDate: "2026-08-10" })], [payment({ scheduleEntryId: "upcoming" })], [], "upcoming"],
  ];

  it.each(statusCases)("returns %s when it has the highest-priority entry state", (_name, entries, payments, promises, expected) => {
    expect(getLoanCollectionStatus({ loan: loan(), entries, payments, promises, today: TODAY })).toBe(expected);
  });
});

describe("borrower filters", () => {
  it("finds accent-insensitive names and space-normalized phone numbers without changing source order", () => {
    const borrowers = [
      borrower({ id: "an", displayName: "Nguyễn  Văn  An", phone: "0901 234 567" }),
      borrower({ id: "binh", displayName: "Bình Minh", phone: "0988-765-432" }),
    ];

    expect(filterBorrowers({ borrowers, query: "  nguyen van an ", status: "all" }).map(({ id }) => id)).toEqual(["an"]);
    expect(filterBorrowers({ borrowers, query: "0988 765 432", status: "all" }).map(({ id }) => id)).toEqual(["binh"]);
    expect(borrowers.map(({ id }) => id)).toEqual(["an", "binh"]);
  });

  it("filters borrowers by active and archived status", () => {
    const borrowers = [borrower({ id: "active" }), borrower({ id: "archived", status: "archived" })];

    expect(filterBorrowers({ borrowers, query: "", status: "active" }).map(({ id }) => id)).toEqual(["active"]);
    expect(filterBorrowers({ borrowers, query: "", status: "archived" }).map(({ id }) => id)).toEqual(["archived"]);
  });
});

describe("loan filters", () => {
  it("filters by borrower, lifecycle status, and calculated collection status while retaining context order", () => {
    const contexts = [
      { loan: loan({ id: "due", borrowerId: "borrower-1", status: "active" }), entries: [entry({ id: "due" })], payments: [], promises: [], today: TODAY },
      { loan: loan({ id: "overdue", borrowerId: "borrower-1", status: "active" }), entries: [entry({ id: "overdue", dueDate: "2026-07-09" })], payments: [], promises: [], today: TODAY },
      { loan: loan({ id: "archived", borrowerId: "borrower-2", status: "archived" }), entries: [entry({ id: "archived", dueDate: "2026-08-10" })], payments: [], promises: [], today: TODAY },
    ];

    expect(filterLoans({
      contexts,
      filter: { borrowerId: "borrower-1", loanStatuses: ["active"], collectionStatuses: ["overdue", "due"] },
    }).map(({ id }) => id)).toEqual(["due", "overdue"]);
    expect(contexts.map(({ loan }) => loan.id)).toEqual(["due", "overdue", "archived"]);
  });
});

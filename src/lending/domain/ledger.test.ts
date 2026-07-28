import { describe, expect, it } from "vitest";
import { calculateEntryStatus, calculateEntryTotals, calculateLoanSummary } from "./ledger";
import type { DateOnly, EntryStatus, PaymentTransaction, PromiseToPay, ScheduleEntry } from "./types";

function entry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "entry-1",
    scheduleVersionId: "version-1",
    periodStart: "2026-07-01",
    dueDate: "2026-07-10",
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
    receivedAt: "2026-07-10",
    principalAmount: 0,
    interestAmount: 0,
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

describe("ledger totals", () => {
  it("aggregates multiple entry payments by component and caps displayed overpayment", () => {
    expect(
      calculateEntryTotals(entry(), [
        payment({ principalAmount: 400, interestAmount: 50 }),
        payment({ id: "payment-2", principalAmount: 800, interestAmount: 25 }),
        payment({ id: "payment-3", scheduleEntryId: undefined, principalAmount: 9_999, interestAmount: 9_999 }),
      ]),
    ).toEqual({
      receivedPrincipal: 1_200,
      receivedInterest: 75,
      outstandingPrincipal: 0,
      outstandingInterest: 25,
    });
  });
});

describe("entry status", () => {
  const statusCases: Array<[string, ScheduleEntry, PaymentTransaction[], PromiseToPay[], DateOnly, EntryStatus]> = [
    ["upcoming", entry({ dueDate: "2026-07-11" }), [], [], "2026-07-10", "upcoming"],
    ["due", entry(), [], [], "2026-07-10", "due"],
    ["paid", entry(), [payment({ principalAmount: 1_000, interestAmount: 100 })], [], "2026-07-10", "paid"],
    ["partially paid", entry(), [payment({ principalAmount: 1_000, interestAmount: 20 })], [], "2026-07-10", "partially-paid"],
    ["overdue", entry(), [], [], "2026-07-11", "overdue"],
    ["open future promise", entry(), [], [promise({ promisedDate: "2026-07-12" })], "2026-07-11", "promised"],
    ["expired promise", entry(), [], [promise({ promisedDate: "2026-07-10" })], "2026-07-11", "overdue"],
  ];

  it.each(statusCases)("returns %s with the approved precedence", (_caseName, scheduleEntry, payments, promises, today, expected) => {
    expect(calculateEntryStatus({ entry: scheduleEntry, payments, promises, today })).toBe(expected);
  });
});

describe("loan summaries", () => {
  it("reports independent balances, due counts, overdue count, and the next unresolved due date", () => {
    const entries = [
      entry({ id: "overdue", dueDate: "2026-07-08", expectedPrincipal: 500, expectedInterest: 50 }),
      entry({ id: "today", dueDate: "2026-07-10", expectedPrincipal: 600, expectedInterest: 60 }),
      entry({ id: "soon", dueDate: "2026-07-12", expectedPrincipal: 700, expectedInterest: 70 }),
      entry({ id: "later", dueDate: "2026-07-20", expectedPrincipal: 800, expectedInterest: 80 }),
    ];

    expect(
      calculateLoanSummary({
        loanId: "loan-1",
        entries,
        payments: [
          payment({ scheduleEntryId: "overdue", principalAmount: 500, interestAmount: 50 }),
          payment({ id: "payment-2", scheduleEntryId: "soon", principalAmount: 700, interestAmount: 20 }),
        ],
        promises: [promise({ scheduleEntryId: "later", promisedDate: "2026-07-22" })],
        today: "2026-07-10",
      }),
    ).toEqual({
      loanId: "loan-1",
      outstandingPrincipal: 1_400,
      outstandingInterest: 190,
      dueToday: 1,
      dueSoon: 1,
      overdue: 0,
      nextDueDate: "2026-07-10",
    });
  });

  it("retains the supplied loan ID when the loan has no payments or promises", () => {
    expect(
      calculateLoanSummary({
        loanId: "loan-without-transactions",
        entries: [entry({ dueDate: "2026-07-12" })],
        payments: [],
        promises: [],
        today: "2026-07-10",
      }),
    ).toMatchObject({ loanId: "loan-without-transactions" });
  });
});

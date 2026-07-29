import { describe, expect, it } from "vitest";
import { evaluateSettlementEligibility, reopenLoan, settleLoan } from "./loanLifecycle";
import type { LoanSummary } from "./ledger";
import type { Loan } from "./types";

function summary(overrides: Partial<LoanSummary> = {}): LoanSummary {
  return {
    loanId: "loan-1",
    outstandingPrincipal: 0,
    outstandingInterest: 0,
    dueToday: 0,
    dueSoon: 0,
    promised: 0,
    overdue: 0,
    ...overrides,
  };
}

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "loan-1",
    borrowerId: "borrower-1",
    calculationModel: "equal-principal-flat-interest",
    originalPrincipal: 10_000,
    disbursementDate: "2026-01-01",
    monthlyDueDay: 5,
    maturityDate: "2026-12-05",
    rateValue: 0.02,
    rateUnit: "monthly",
    partialPeriodInterestMode: "full-period",
    defaultScheduleVersionId: "version-1",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("settlement eligibility", () => {
  it("allows settlement only when both component balances are zero", () => {
    expect(evaluateSettlementEligibility(summary())).toEqual({
      eligible: true,
      outstandingPrincipal: 0,
      outstandingInterest: 0,
    });
  });

  it.each([
    [100, 0],
    [0, 100],
  ])("rejects settlement when principal is %i and interest is %i", (outstandingPrincipal, outstandingInterest) => {
    expect(evaluateSettlementEligibility(summary({ outstandingPrincipal, outstandingInterest }))).toEqual({
      eligible: false,
      outstandingPrincipal,
      outstandingInterest,
    });
  });

  it("does not mutate the supplied summary", () => {
    const input = summary({ outstandingPrincipal: 100, outstandingInterest: 50 });

    evaluateSettlementEligibility(input);

    expect(input).toEqual(summary({ outstandingPrincipal: 100, outstandingInterest: 50 }));
  });
});

describe("loan settlement", () => {
  it("settles an active loan with cleared balances on the selected past date", () => {
    const currentLoan = loan();

    expect(settleLoan({
      loan: currentLoan,
      summary: summary(),
      settlementDate: "2026-07-15",
      eventId: "event-1",
      now: "2026-07-30T12:00:00.000Z",
    })).toEqual({
      loan: {
        ...currentLoan,
        status: "settled",
        settledAt: "2026-07-15",
        updatedAt: "2026-07-30T12:00:00.000Z",
      },
      event: {
        id: "event-1",
        loanId: "loan-1",
        action: "settled",
        effectiveDate: "2026-07-15",
        createdAt: "2026-07-30T12:00:00.000Z",
      },
    });
    expect(currentLoan).toEqual(loan());
  });

  it.each(["settled", "archived"] as const)("rejects settlement for a %s loan", (status) => {
    expect(() => settleLoan({
      loan: loan({ status }),
      summary: summary(),
      settlementDate: "2026-07-15",
      eventId: "event-1",
      now: "2026-07-30T12:00:00.000Z",
    })).toThrow("loan must be active to settle");
  });

  it("rejects settlement while either balance remains outstanding", () => {
    expect(() => settleLoan({
      loan: loan(),
      summary: summary({ outstandingInterest: 100 }),
      settlementDate: "2026-07-15",
      eventId: "event-1",
      now: "2026-07-30T12:00:00.000Z",
    })).toThrow("loan is not eligible for settlement");
  });

  it.each([
    ["a blank date", ""],
    ["a malformed date", "2026-02-30"],
  ])("rejects settlement with %s", (_description, settlementDate) => {
    expect(() => settleLoan({
      loan: loan(),
      summary: summary(),
      settlementDate,
      eventId: "event-1",
      now: "2026-07-30T12:00:00.000Z",
    })).toThrow("settlement date must be a valid DateOnly");
  });
});

describe("loan reopening", () => {
  it("reopens a settled loan, clears its settlement date, and records the reason", () => {
    const settledLoan = loan({ status: "settled", settledAt: "2026-07-15" });

    expect(reopenLoan({
      loan: settledLoan,
      reason: "Corrected a voided payment",
      eventId: "event-2",
      effectiveDate: "2026-07-30",
      now: "2026-07-30T12:00:00.000Z",
    })).toEqual({
      loan: {
        ...loan(),
        status: "active",
        updatedAt: "2026-07-30T12:00:00.000Z",
      },
      event: {
        id: "event-2",
        loanId: "loan-1",
        action: "reopened",
        effectiveDate: "2026-07-30",
        reason: "Corrected a voided payment",
        createdAt: "2026-07-30T12:00:00.000Z",
      },
    });
  });

  it("requires a non-whitespace reason to reopen a loan", () => {
    expect(() => reopenLoan({
      loan: loan({ status: "settled", settledAt: "2026-07-15" }),
      reason: "  ",
      eventId: "event-2",
      effectiveDate: "2026-07-30",
      now: "2026-07-30T12:00:00.000Z",
    })).toThrow("reason is required");
  });

  it("rejects reopening a loan that is not settled", () => {
    expect(() => reopenLoan({
      loan: loan(),
      reason: "Corrected a voided payment",
      eventId: "event-2",
      effectiveDate: "2026-07-30",
      now: "2026-07-30T12:00:00.000Z",
    })).toThrow("loan must be settled to reopen");
  });

  it.each(["", "2026-02-30"])("rejects reopening with invalid effective date %j", (effectiveDate) => {
    expect(() => reopenLoan({
      loan: loan({ status: "settled", settledAt: "2026-07-15" }),
      reason: "Corrected a voided payment",
      eventId: "event-2",
      effectiveDate,
      now: "2026-07-30T12:00:00.000Z",
    })).toThrow("effective date must be a valid DateOnly");
  });
});

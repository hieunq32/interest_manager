import type { LoanSummary } from "./ledger";
import type { DateOnly, Loan, LoanLifecycleEvent, MoneyVnd } from "./types";

export interface SettlementEligibility {
  eligible: boolean;
  outstandingPrincipal: MoneyVnd;
  outstandingInterest: MoneyVnd;
}

export function evaluateSettlementEligibility(summary: LoanSummary): SettlementEligibility {
  return {
    eligible: summary.outstandingPrincipal === 0 && summary.outstandingInterest === 0,
    outstandingPrincipal: summary.outstandingPrincipal,
    outstandingInterest: summary.outstandingInterest,
  };
}

export function settleLoan(input: {
  loan: Loan;
  summary: LoanSummary;
  settlementDate: DateOnly;
  eventId: string;
  now: string;
}): { loan: Loan; event: LoanLifecycleEvent } {
  if (input.loan.status !== "active") {
    throw new Error("loan must be active to settle");
  }
  if (!evaluateSettlementEligibility(input.summary).eligible) {
    throw new Error("loan is not eligible for settlement");
  }

  return {
    loan: {
      ...input.loan,
      status: "settled",
      settledAt: input.settlementDate,
      updatedAt: input.now,
    },
    event: {
      id: input.eventId,
      loanId: input.loan.id,
      action: "settled",
      effectiveDate: input.settlementDate,
      createdAt: input.now,
    },
  };
}

export function reopenLoan(input: {
  loan: Loan;
  reason: string;
  eventId: string;
  effectiveDate: DateOnly;
  now: string;
}): { loan: Loan; event: LoanLifecycleEvent } {
  if (input.loan.status !== "settled") {
    throw new Error("loan must be settled to reopen");
  }
  if (input.reason.trim() === "") {
    throw new Error("reason is required");
  }

  const { settledAt: _settledAt, ...loan } = input.loan;
  return {
    loan: {
      ...loan,
      status: "active",
      updatedAt: input.now,
    },
    event: {
      id: input.eventId,
      loanId: input.loan.id,
      action: "reopened",
      effectiveDate: input.effectiveDate,
      reason: input.reason,
      createdAt: input.now,
    },
  };
}

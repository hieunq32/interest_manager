import { compareDateOnly } from "./dateRules";
import { calculateEntryStatus } from "./ledger";
import type {
  Borrower,
  DateOnly,
  Loan,
  LoanStatus,
  PaymentTransaction,
  PromiseToPay,
  ScheduleEntry,
} from "./types";

export type LoanCollectionStatus = "upcoming" | "due" | "promised" | "overdue" | "paid";

export interface LoanFilter {
  borrowerId?: string;
  loanStatuses?: LoanStatus[];
  collectionStatuses?: LoanCollectionStatus[];
}

export interface LoanCollectionContext {
  loan: Loan;
  entries: ScheduleEntry[];
  payments: PaymentTransaction[];
  promises: PromiseToPay[];
  today: DateOnly;
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function getLoanCollectionStatus(input: LoanCollectionContext): LoanCollectionStatus {
  if (!input.entries.some((entry) => compareDateOnly(entry.dueDate, input.today) <= 0)) {
    return "upcoming";
  }

  const entryStatuses = input.entries.map((entry) => calculateEntryStatus({ ...input, entry }));

  if (entryStatuses.includes("overdue")) {
    return "overdue";
  }
  if (entryStatuses.includes("due") || entryStatuses.includes("partially-paid")) {
    return "due";
  }
  if (entryStatuses.includes("promised")) {
    return "promised";
  }
  if (entryStatuses.includes("paid")) {
    return "paid";
  }
  return "upcoming";
}

export function filterBorrowers(input: {
  borrowers: Borrower[];
  query: string;
  status: "all" | "active" | "archived";
}): Borrower[] {
  const query = normalizeSearchText(input.query);
  const phoneQuery = normalizePhone(input.query);

  return input.borrowers.filter((borrower) => {
    if (input.status !== "all" && borrower.status !== input.status) {
      return false;
    }
    if (query === "") {
      return true;
    }
    return (
      normalizeSearchText(borrower.displayName).includes(query) ||
      (phoneQuery !== "" && normalizePhone(borrower.phone ?? "").includes(phoneQuery))
    );
  });
}

export function filterLoans(input: {
  contexts: LoanCollectionContext[];
  filter: LoanFilter;
}): Loan[] {
  return input.contexts
    .filter(({ loan }) => input.filter.borrowerId === undefined || loan.borrowerId === input.filter.borrowerId)
    .filter(({ loan }) => input.filter.loanStatuses === undefined || input.filter.loanStatuses.includes(loan.status))
    .filter((context) => (
      input.filter.collectionStatuses === undefined ||
      input.filter.collectionStatuses.includes(getLoanCollectionStatus(context))
    ))
    .map(({ loan }) => loan);
}

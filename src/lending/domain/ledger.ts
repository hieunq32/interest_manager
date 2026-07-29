import { compareDateOnly } from "./dateRules";
import { normalizePayment } from "./paymentCorrections";
import type {
  DateOnly,
  EntryStatus,
  MoneyVnd,
  PaymentTransaction,
  PromiseToPay,
  ScheduleEntry,
  ScheduleVersion,
} from "./types";

export interface EntryTotals {
  receivedPrincipal: MoneyVnd;
  receivedInterest: MoneyVnd;
  outstandingPrincipal: MoneyVnd;
  outstandingInterest: MoneyVnd;
}

export interface LoanSummary {
  loanId: string;
  outstandingPrincipal: MoneyVnd;
  outstandingInterest: MoneyVnd;
  dueToday: number;
  dueSoon: number;
  promised: number;
  overdue: number;
  nextDueDate?: DateOnly;
}

const DUE_SOON_DAYS = 7;

function isOpenFuturePromise(promise: PromiseToPay, today: DateOnly): boolean {
  return promise.status === "open" && compareDateOnly(promise.promisedDate, today) > 0;
}

function addDays(date: DateOnly, days: number): DateOnly {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, month - 1, day + days);
  return `${String(value.getUTCFullYear()).padStart(4, "0")}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function selectCurrentLoanEntries(input: {
  entries: ScheduleEntry[];
  versions: ScheduleVersion[];
  activeScheduleVersionId: string;
}): ScheduleEntry[] {
  const activeVersion = input.versions.find((version) => version.id === input.activeScheduleVersionId);
  if (!activeVersion) {
    return [];
  }

  const oldVersionIds = new Set(
    input.versions
      .filter(
        (version) =>
          version.loanId === activeVersion.loanId &&
          version.versionNumber < activeVersion.versionNumber,
      )
      .map((version) => version.id),
  );

  return input.entries.filter(
    (entry) =>
      entry.scheduleVersionId === activeVersion.id ||
      (
        oldVersionIds.has(entry.scheduleVersionId) &&
        compareDateOnly(entry.dueDate, activeVersion.effectiveDate) <= 0
      ),
  );
}

export function calculateEntryTotals(entry: ScheduleEntry, payments: PaymentTransaction[]): EntryTotals {
  const matchingPayments = payments.filter(
    (payment) => payment.scheduleEntryId === entry.id && normalizePayment(payment).status === "active",
  );
  const receivedPrincipal = matchingPayments.reduce((total, payment) => total + payment.principalAmount, 0);
  const receivedInterest = matchingPayments.reduce((total, payment) => total + payment.interestAmount, 0);

  return {
    receivedPrincipal,
    receivedInterest,
    outstandingPrincipal: Math.max(0, entry.expectedPrincipal - receivedPrincipal),
    outstandingInterest: Math.max(0, entry.expectedInterest - receivedInterest),
  };
}

export function calculateEntryStatus(input: {
  entry: ScheduleEntry;
  payments: PaymentTransaction[];
  promises: PromiseToPay[];
  today: DateOnly;
}): EntryStatus {
  const totals = calculateEntryTotals(input.entry, input.payments);
  if (totals.outstandingPrincipal === 0 && totals.outstandingInterest === 0) {
    return "paid";
  }

  if (
    input.promises.some(
      (promise) => promise.scheduleEntryId === input.entry.id && isOpenFuturePromise(promise, input.today),
    )
  ) {
    return "promised";
  }

  if (
    input.promises.some(
      (promise) =>
        promise.scheduleEntryId === input.entry.id &&
        promise.status === "open" &&
        compareDateOnly(promise.promisedDate, input.today) <= 0,
    )
  ) {
    return "overdue";
  }

  if (compareDateOnly(input.entry.dueDate, input.today) < 0) {
    return "overdue";
  }
  if (totals.receivedPrincipal > 0 || totals.receivedInterest > 0) {
    return "partially-paid";
  }
  if (compareDateOnly(input.entry.dueDate, input.today) === 0) {
    return "due";
  }
  return "upcoming";
}

export function calculateLoanSummary(input: {
  loanId: string;
  entries: ScheduleEntry[];
  payments: PaymentTransaction[];
  promises: PromiseToPay[];
  today: DateOnly;
}): LoanSummary {
  const dueSoonEnd = addDays(input.today, DUE_SOON_DAYS);
  let outstandingPrincipal = 0;
  let outstandingInterest = 0;
  let dueToday = 0;
  let dueSoon = 0;
  let promised = 0;
  let overdue = 0;
  const unresolvedDueDates: DateOnly[] = [];

  for (const entry of input.entries) {
    const totals = calculateEntryTotals(entry, input.payments);
    const status = calculateEntryStatus({ ...input, entry });
    outstandingPrincipal += totals.outstandingPrincipal;
    outstandingInterest += totals.outstandingInterest;

    if (status !== "paid") {
      unresolvedDueDates.push(entry.dueDate);
    }
    if (status === "due") {
      dueToday += 1;
    }
    if (status === "promised") {
      promised += 1;
    }
    if (
      status !== "paid" &&
      status !== "promised" &&
      compareDateOnly(entry.dueDate, input.today) > 0 &&
      compareDateOnly(entry.dueDate, dueSoonEnd) <= 0
    ) {
      dueSoon += 1;
    }
    if (status === "overdue") {
      overdue += 1;
    }
  }

  return {
    loanId: input.loanId,
    outstandingPrincipal,
    outstandingInterest,
    dueToday,
    dueSoon,
    promised,
    overdue,
    nextDueDate: unresolvedDueDates.sort(compareDateOnly)[0],
  };
}

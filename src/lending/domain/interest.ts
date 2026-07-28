import { compareDateOnly, daysInMonth, differenceInCalendarDays } from "./dateRules";
import { assertValidMoney, roundMoney } from "./money";
import type { DateOnly, MoneyVnd, PartialPeriodInterestMode, RateUnit } from "./types";

export interface InterestCalculationInput {
  principalBase: MoneyVnd;
  rateValue: number;
  rateUnit: RateUnit;
  periodStart: DateOnly;
  periodEnd: DateOnly;
  isFirstPeriod: boolean;
  isFinalPeriod: boolean;
  partialPeriodInterestMode: PartialPeriodInterestMode;
}

function assertValidRate(rateValue: number): void {
  if (!Number.isFinite(rateValue)) {
    throw new Error("rateValue must be a finite number");
  }
  if (rateValue < 0) {
    throw new Error("rateValue must be non-negative");
  }
}

function assertValidPeriod(periodStart: DateOnly, periodEnd: DateOnly): void {
  const days = differenceInCalendarDays(periodStart, periodEnd);
  if (days === 0) {
    throw new Error("period must span at least one calendar day");
  }
}

function nextMonthStart(date: DateOnly): DateOnly {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (month === 12) {
    return `${String(year + 1).padStart(4, "0")}-01-01`;
  }
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-01`;
}

export function calculateMonthlyProratedInterest(
  principalBase: MoneyVnd,
  monthlyRate: number,
  periodStart: DateOnly,
  periodEnd: DateOnly,
): MoneyVnd {
  assertValidMoney(principalBase, "principalBase");
  assertValidRate(monthlyRate);
  assertValidPeriod(periodStart, periodEnd);

  let cursor = periodStart;
  let unroundedInterest = 0;
  while (compareDateOnly(cursor, periodEnd) < 0) {
    const monthEnd = nextMonthStart(cursor);
    const segmentEnd = compareDateOnly(monthEnd, periodEnd) < 0 ? monthEnd : periodEnd;
    const segmentDays = differenceInCalendarDays(cursor, segmentEnd);
    const monthDays = daysInMonth(Number(cursor.slice(0, 4)), Number(cursor.slice(5, 7)));
    unroundedInterest += principalBase * monthlyRate * segmentDays / monthDays;
    cursor = segmentEnd;
  }

  return roundMoney(unroundedInterest);
}

export function calculatePeriodInterest(input: InterestCalculationInput): MoneyVnd {
  const {
    principalBase,
    rateValue,
    rateUnit,
    periodStart,
    periodEnd,
    isFirstPeriod,
    isFinalPeriod,
    partialPeriodInterestMode,
  } = input;

  assertValidMoney(principalBase, "principalBase");
  assertValidRate(rateValue);
  assertValidPeriod(periodStart, periodEnd);

  if (rateUnit === "daily") {
    return roundMoney(principalBase * rateValue * differenceInCalendarDays(periodStart, periodEnd));
  }
  if (rateUnit !== "monthly") {
    throw new Error("rateUnit must be monthly or daily");
  }
  if (partialPeriodInterestMode !== "full-period" && partialPeriodInterestMode !== "calendar-day-prorated") {
    throw new Error("partialPeriodInterestMode is invalid");
  }

  if (isFirstPeriod || partialPeriodInterestMode === "full-period" || !isFinalPeriod) {
    return roundMoney(principalBase * rateValue);
  }
  return calculateMonthlyProratedInterest(principalBase, rateValue, periodStart, periodEnd);
}

import type { DateOnly } from "./types";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string): { year: number; month: number; day: number } {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid date-only value: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid date-only value: ${value}`);
  }
  return { year, month, day };
}

function utcDate(year: number, month: number, day: number): Date {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, month - 1, day);
  return value;
}

function formatDateOnly(year: number, month: number, day: number): DateOnly {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function assertMonth(month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("month must be between 1 and 12");
  }
}

function assertDueDay(dueDay: number): void {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("due day must be between 1 and 31");
  }
}

export function isDateOnly(value: string): boolean {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    return false;
  }
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

export function compareDateOnly(left: DateOnly, right: DateOnly): number {
  parseDateOnly(left);
  parseDateOnly(right);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function daysInMonth(year: number, month: number): number {
  assertMonth(month);
  if (!Number.isInteger(year) || year < 0 || year > 9999) {
    throw new Error("year must be between 0 and 9999");
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (month === 2) {
    return leapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function resolveDueDate(year: number, month: number, dueDay: number): DateOnly {
  assertMonth(month);
  assertDueDay(dueDay);
  return formatDateOnly(year, month, Math.min(dueDay, daysInMonth(year, month)));
}

export function nextDueDateAfter(date: DateOnly, dueDay: number): DateOnly {
  const parsed = parseDateOnly(date);
  assertDueDay(dueDay);
  let year = parsed.year;
  let month = parsed.month;
  let candidate = resolveDueDate(year, month, dueDay);
  if (candidate <= date) {
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    candidate = resolveDueDate(year, month, dueDay);
  }
  return candidate;
}

export function differenceInCalendarDays(start: DateOnly, end: DateOnly): number {
  const startParts = parseDateOnly(start);
  const endParts = parseDateOnly(end);
  const difference = (utcDate(endParts.year, endParts.month, endParts.day).getTime() -
    utcDate(startParts.year, startParts.month, startParts.day).getTime()) / DAY_MS;
  if (difference < 0) {
    throw new Error("end date cannot be before start date");
  }
  return difference;
}

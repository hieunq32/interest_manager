import { compareDateOnly, isDateOnly } from "../domain/dateRules";
import type { DateOnly, PromiseToPay, ReminderSettings, ScheduleEntry } from "../domain/types";
import { resolveReminderSettings } from "./reminderSettings";

const PRODID = "-//Interest Manager//Lending Reminders//EN";
const VIETNAM_UTC_OFFSET_HOURS = 7;

export interface CalendarEventInput {
  uid: string;
  date: DateOnly;
  time: string;
  summary: string;
  description: string;
  reminderOffsetDays: number;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function compareEvents(left: CalendarEventInput, right: CalendarEventInput): number {
  if (left.date !== right.date) {
    return left.date < right.date ? -1 : 1;
  }
  if (left.uid !== right.uid) {
    return left.uid < right.uid ? -1 : 1;
  }
  return 0;
}

function parseTime(time: string): { hour: number; minute: number } {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(time);
  if (!match) {
    throw new Error("time must use HH:MM in 24-hour time");
  }
  return { hour: Number(time.slice(0, 2)), minute: Number(time.slice(3, 5)) };
}

function formatUtcDateTime(date: DateOnly, time: string): string {
  if (!isDateOnly(date)) {
    throw new Error(`Invalid date-only value: ${date}`);
  }
  const { hour, minute } = parseTime(time);
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  value.setUTCHours(hour - VIETNAM_UTC_OFFSET_HOURS, minute, 0, 0);

  return `${String(value.getUTCFullYear()).padStart(4, "0")}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}T${String(value.getUTCHours()).padStart(2, "0")}${String(value.getUTCMinutes()).padStart(2, "0")}00Z`;
}

function assertValidEvent(event: CalendarEventInput): void {
  if (!Number.isInteger(event.reminderOffsetDays) || event.reminderOffsetDays < 0) {
    throw new Error("reminderOffsetDays must be a non-negative integer");
  }
}

function vietnamToday(): DateOnly {
  const local = new Date(Date.now() + VIETNAM_UTC_OFFSET_HOURS * 60 * 60 * 1_000);
  return `${String(local.getUTCFullYear()).padStart(4, "0")}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function scheduleEntryDescription(entry: ScheduleEntry, borrowerName: string, loanLabel: string): string {
  return [
    `Borrower: ${borrowerName}`,
    `Loan: ${loanLabel}`,
    `Schedule version: ${entry.scheduleVersionId}`,
    `Schedule entry: ${entry.id}`,
    `Due date: ${entry.dueDate}`,
    `Outstanding: ${entry.expectedPrincipal + entry.expectedInterest} VND`,
  ].join("\n");
}

function promiseDescription(
  promise: PromiseToPay,
  entry: ScheduleEntry,
  borrowerName: string,
  loanLabel: string,
): string {
  return [
    `Borrower: ${borrowerName}`,
    `Loan: ${loanLabel}`,
    `Schedule version: ${entry.scheduleVersionId}`,
    `Schedule entry: ${entry.id}`,
    `Promise: ${promise.id}`,
    `Promised date: ${promise.promisedDate}`,
    `Note: ${promise.note}`,
  ].join("\n");
}

export function buildIcsCalendar(events: CalendarEventInput[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${PRODID}`, "CALSCALE:GREGORIAN"];

  for (const event of [...events].sort(compareEvents)) {
    assertValidEvent(event);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.uid)}`,
      `DTSTART:${formatUtcDateTime(event.date, event.time)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      "BEGIN:VALARM",
      `TRIGGER:-P${event.reminderOffsetDays}D`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.summary)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function buildScheduleCalendarEvents(input: {
  entries: ScheduleEntry[];
  promises: PromiseToPay[];
  borrowerName: string;
  loanLabel: string;
  settings: ReminderSettings;
}): CalendarEventInput[] {
  const settings = resolveReminderSettings(input.settings);
  if (!settings.enabled) {
    return [];
  }

  const today = vietnamToday();
  const entriesById = new Map(input.entries.map((entry) => [entry.id, entry]));
  const events: CalendarEventInput[] = [];

  for (const entry of input.entries) {
    const outstandingAmount = entry.expectedPrincipal + entry.expectedInterest;
    if (entry.status === "paid" || outstandingAmount <= 0 || compareDateOnly(entry.dueDate, today) <= 0) {
      continue;
    }
    events.push({
      uid: `entry-${entry.scheduleVersionId}-${entry.id}@interest-manager.local`,
      date: entry.dueDate,
      time: settings.time,
      summary: `Payment due: ${input.loanLabel}`,
      description: scheduleEntryDescription(entry, input.borrowerName, input.loanLabel),
      reminderOffsetDays: settings.offsetDays,
    });
  }

  for (const promise of input.promises) {
    const entry = entriesById.get(promise.scheduleEntryId);
    if (
      promise.status !== "open" ||
      entry === undefined ||
      entry.status === "paid" ||
      compareDateOnly(promise.promisedDate, today) <= 0
    ) {
      continue;
    }
    events.push({
      uid: `promise-${entry.scheduleVersionId}-${promise.id}@interest-manager.local`,
      date: promise.promisedDate,
      time: settings.time,
      summary: `Promise to pay: ${input.loanLabel}`,
      description: promiseDescription(promise, entry, input.borrowerName, input.loanLabel),
      reminderOffsetDays: settings.offsetDays,
    });
  }

  return events.sort(compareEvents);
}

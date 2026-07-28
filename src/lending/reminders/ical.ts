import { compareDateOnly, isDateOnly } from "../domain/dateRules";
import type { DateOnly, PromiseToPay, ReminderSettings, ScheduleEntry } from "../domain/types";
import { resolveReminderSettings } from "./reminderSettings";

const PRODID = "-//Interest Manager//Lending Reminders//EN";
const VIETNAM_UTC_OFFSET_HOURS = 7;
const UTC_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;

export interface CalendarEventInput {
  uid: string;
  date: DateOnly;
  time: string;
  summary: string;
  description: string;
  reminderOffsetDays: number;
  dtstampUtc: string;
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

function formatUtcTimestamp(dtstampUtc: string): string {
  const match = UTC_TIMESTAMP_PATTERN.exec(dtstampUtc);
  if (!match) {
    throw new Error("dtstampUtc must be an ISO UTC timestamp");
  }

  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  value.setUTCHours(hour, minute, second, 0);
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day ||
    value.getUTCHours() !== hour ||
    value.getUTCMinutes() !== minute ||
    value.getUTCSeconds() !== second
  ) {
    throw new Error("dtstampUtc must be a valid ISO UTC timestamp");
  }

  return `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}${String(second).padStart(2, "0")}Z`;
}

function assertValidEvent(event: CalendarEventInput): void {
  if (!Number.isInteger(event.reminderOffsetDays) || event.reminderOffsetDays < 0) {
    throw new Error("reminderOffsetDays must be a non-negative integer");
  }
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
      `DTSTAMP:${formatUtcTimestamp(event.dtstampUtc)}`,
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
  today: DateOnly;
}): CalendarEventInput[] {
  const settings = resolveReminderSettings(input.settings);
  if (!settings.enabled) {
    return [];
  }

  if (!isDateOnly(input.today)) {
    throw new Error(`Invalid date-only value: ${input.today}`);
  }
  const entriesById = new Map(input.entries.map((entry) => [entry.id, entry]));
  const events: CalendarEventInput[] = [];

  for (const entry of input.entries) {
    const outstandingAmount = entry.expectedPrincipal + entry.expectedInterest;
    if (entry.status === "paid" || outstandingAmount <= 0 || compareDateOnly(entry.dueDate, input.today) <= 0) {
      continue;
    }
    events.push({
      uid: `entry-${entry.scheduleVersionId}-${entry.id}@interest-manager.local`,
      date: entry.dueDate,
      time: settings.time,
      summary: `Payment due: ${input.loanLabel}`,
      description: scheduleEntryDescription(entry, input.borrowerName, input.loanLabel),
      reminderOffsetDays: settings.offsetDays,
      dtstampUtc: entry.createdAt,
    });
  }

  for (const promise of input.promises) {
    const entry = entriesById.get(promise.scheduleEntryId);
    if (
      promise.status !== "open" ||
      entry === undefined ||
      compareDateOnly(promise.promisedDate, input.today) <= 0
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
      dtstampUtc: promise.createdAt,
    });
  }

  return events.sort(compareEvents);
}

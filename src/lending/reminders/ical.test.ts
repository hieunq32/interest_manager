import { afterEach, describe, expect, it, vi } from "vitest";
import type { PromiseToPay, ReminderSettings, ScheduleEntry } from "../domain/types";
import { buildIcsCalendar, buildScheduleCalendarEvents, type CalendarEventInput } from "./ical";

function settings(overrides: Partial<ReminderSettings> = {}): ReminderSettings {
  return { enabled: true, offsetDays: 1, time: "08:00", ...overrides };
}

function entry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "entry-1",
    scheduleVersionId: "version-7",
    periodStart: "2026-07-01",
    dueDate: "2026-07-12",
    expectedPrincipal: 1_000,
    expectedInterest: 100,
    status: "upcoming",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function promise(overrides: Partial<PromiseToPay> = {}): PromiseToPay {
  return {
    id: "promise-1",
    loanId: "loan-1",
    scheduleEntryId: "entry-1",
    promisedDate: "2026-07-15",
    note: "Will pay after payday",
    status: "open",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => vi.useRealTimers());

describe("iCalendar serialization", () => {
  it("serializes stable event IDs, Vietnam local time in UTC, alarms, and CRLF endings", () => {
    const events: CalendarEventInput[] = [
      {
        uid: "entry-version-7-entry-1@interest-manager.local",
        date: "2026-07-12",
        time: "08:00",
        summary: "Payment due: Home loan",
        description: "Borrower: Lan",
        reminderOffsetDays: 1,
        dtstampUtc: "2026-07-01T00:00:00.000Z",
      },
      {
        uid: "promise-version-7-promise-1@interest-manager.local",
        date: "2026-07-15",
        time: "08:00",
        summary: "Promise to pay: Home loan",
        description: "Borrower: Lan",
        reminderOffsetDays: 1,
        dtstampUtc: "2026-07-10T00:00:00.000Z",
      },
    ];

    const result = buildIcsCalendar(events);

    expect(result).toContain("BEGIN:VCALENDAR\r\n");
    expect(result).toContain("BEGIN:VEVENT\r\n");
    expect(result).toContain("UID:entry-version-7-entry-1@interest-manager.local\r\n");
    expect(result).toContain("DTSTAMP:20260701T000000Z\r\n");
    expect(result).toContain("DTSTART:20260712T010000Z\r\n");
    expect(result).toContain("TRIGGER:-P1D\r\n");
    expect(result).toMatch(/\r\n$/);
    expect(result.replace(/\r\n/g, "")).not.toContain("\n");
    expect(buildIcsCalendar([...events].reverse())).toBe(result);
  });

  it("escapes commas, semicolons, backslashes, and newlines from borrower names and notes", () => {
    const result = buildIcsCalendar(
      buildScheduleCalendarEvents({
        entries: [entry()],
        promises: [promise({ note: "Follow, up; \\ tomorrow\nAfter lunch" })],
        borrowerName: "Lan, Nguyen; \\ family\nSecond line",
        loanLabel: "Home loan",
        settings: settings(),
        today: "2026-07-10",
      }),
    );

    expect(result).toContain("DESCRIPTION:Borrower: Lan\\, Nguyen\\; \\\\ family\\nSecond line\\nLoan: Home loan");
    expect(result).toContain("Note: Follow\\, up\\; \\\\ tomorrow\\nAfter lunch\r\n");
  });

  it("rejects a non-UTC deterministic event timestamp", () => {
    expect(() =>
      buildIcsCalendar([
        {
          uid: "entry-version-7-entry-1@interest-manager.local",
          date: "2026-07-12",
          time: "08:00",
          summary: "Payment due: Home loan",
          description: "Borrower: Lan",
          reminderOffsetDays: 1,
          dtstampUtc: "2026-07-01T00:00:00+07:00",
        },
      ]),
    ).toThrow(/dtstampUtc/);
  });

  it("exports only future outstanding entries and open future promises with stable descriptions", () => {
    const events = buildScheduleCalendarEvents({
      entries: [
        entry(),
        entry({ id: "paid-entry", dueDate: "2026-07-13", status: "paid" }),
        entry({ id: "zero-entry", dueDate: "2026-07-14", expectedPrincipal: 0, expectedInterest: 0 }),
        entry({ id: "past-entry", dueDate: "2026-07-09" }),
      ],
      promises: [
        promise(),
        promise({ id: "fulfilled-promise", promisedDate: "2026-07-16", status: "fulfilled" }),
        promise({ id: "past-promise", promisedDate: "2026-07-09" }),
      ],
      borrowerName: "Lan Nguyen",
      loanLabel: "Home loan",
      settings: settings(),
      today: "2026-07-10",
    });

    expect(events).toEqual([
      {
        uid: "entry-version-7-entry-1@interest-manager.local",
        date: "2026-07-12",
        time: "08:00",
        summary: "Payment due: Home loan",
        description:
          "Borrower: Lan Nguyen\nLoan: Home loan\nSchedule version: version-7\nSchedule entry: entry-1\nDue date: 2026-07-12\nOutstanding: 1100 VND",
        reminderOffsetDays: 1,
        dtstampUtc: "2026-07-01T00:00:00.000Z",
      },
      {
        uid: "promise-version-7-promise-1@interest-manager.local",
        date: "2026-07-15",
        time: "08:00",
        summary: "Promise to pay: Home loan",
        description:
          "Borrower: Lan Nguyen\nLoan: Home loan\nSchedule version: version-7\nSchedule entry: entry-1\nPromise: promise-1\nPromised date: 2026-07-15\nNote: Will pay after payday",
        reminderOffsetDays: 1,
        dtstampUtc: "2026-07-10T00:00:00.000Z",
      },
    ]);
  });

  it("does not generate events when reminders are disabled for the loan", () => {
    expect(
      buildScheduleCalendarEvents({
        entries: [entry()],
        promises: [promise()],
        borrowerName: "Lan Nguyen",
        loanLabel: "Home loan",
        settings: settings({ enabled: false }),
        today: "2026-07-10",
      }),
    ).toEqual([]);
  });

  it("uses the supplied today value instead of the system clock for future filtering", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T00:00:00.000Z"));

    expect(
      buildScheduleCalendarEvents({
        entries: [entry()],
        promises: [promise()],
        borrowerName: "Lan Nguyen",
        loanLabel: "Home loan",
        settings: settings(),
        today: "2026-07-16",
      }),
    ).toEqual([]);
  });

  it("excludes an open future promise when its linked schedule entry is paid", () => {
    expect(
      buildScheduleCalendarEvents({
        entries: [entry({ status: "paid" })],
        promises: [promise()],
        borrowerName: "Lan Nguyen",
        loanLabel: "Home loan",
        settings: settings(),
        today: "2026-07-10",
      }),
    ).toEqual([]);
  });

  it("keeps an open future promise when its linked schedule entry is partially paid", () => {
    expect(
      buildScheduleCalendarEvents({
        entries: [entry({ status: "partially-paid" })],
        promises: [promise()],
        borrowerName: "Lan Nguyen",
        loanLabel: "Home loan",
        settings: settings(),
        today: "2026-07-10",
      }),
    ).toEqual([
      expect.objectContaining({
        uid: "entry-version-7-entry-1@interest-manager.local",
        summary: "Payment due: Home loan",
      }),
      expect.objectContaining({
        uid: "promise-version-7-promise-1@interest-manager.local",
        summary: "Promise to pay: Home loan",
      }),
    ]);
  });

  it("normalizes a date-only source creation value into a deterministic UTC timestamp", () => {
    const events = buildScheduleCalendarEvents({
      entries: [entry({ createdAt: "2026-07-01" })],
      promises: [],
      borrowerName: "Lan Nguyen",
      loanLabel: "Home loan",
      settings: settings(),
      today: "2026-07-10",
    });

    expect(events).toEqual([
      expect.objectContaining({
        dtstampUtc: "2026-07-01T00:00:00.000Z",
      }),
    ]);
    expect(buildIcsCalendar(events)).toContain("DTSTAMP:20260701T000000Z\r\n");
  });
});

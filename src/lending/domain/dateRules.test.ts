import { describe, expect, it } from "vitest";
import {
  compareDateOnly,
  daysInMonth,
  differenceInCalendarDays,
  isDateOnly,
  nextDueDateAfter,
  resolveDueDate,
} from "./dateRules";

describe("date-only rules", () => {
  it("recognizes only real YYYY-MM-DD calendar dates", () => {
    expect(isDateOnly("2026-07-28")).toBe(true);
    expect(isDateOnly("2026-02-29")).toBe(false);
    expect(isDateOnly("2024-02-29")).toBe(true);
    expect(isDateOnly("2026-2-8")).toBe(false);
    expect(isDateOnly("2026-02-30")).toBe(false);
  });

  it("resolves day 31 to the target month's final day", () => {
    expect(resolveDueDate(2026, 4, 31)).toBe("2026-04-30");
    expect(resolveDueDate(2026, 2, 31)).toBe("2026-02-28");
    expect(resolveDueDate(2024, 2, 31)).toBe("2024-02-29");
  });

  it("returns the next due date strictly after the input date", () => {
    expect(nextDueDateAfter("2026-01-05", 5)).toBe("2026-02-05");
    expect(nextDueDateAfter("2026-01-04", 5)).toBe("2026-01-05");
    expect(nextDueDateAfter("2026-01-31", 31)).toBe("2026-02-28");
  });

  it("compares date-only values chronologically", () => {
    expect(compareDateOnly("2026-01-01", "2026-01-02")).toBeLessThan(0);
    expect(compareDateOnly("2026-01-02", "2026-01-02")).toBe(0);
    expect(compareDateOnly("2026-01-03", "2026-01-02")).toBeGreaterThan(0);
  });

  it("reports month lengths with leap-year behavior", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(4, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
  });

  it("calculates calendar-day differences without timezone shifts", () => {
    expect(differenceInCalendarDays("2026-01-01", "2026-01-31")).toBe(30);
    expect(differenceInCalendarDays("2024-02-28", "2024-03-01")).toBe(2);
  });

  it("rejects invalid date and range inputs", () => {
    expect(() => daysInMonth(2026, 0)).toThrow(/month/);
    expect(() => daysInMonth(2026, 13)).toThrow(/month/);
    expect(() => resolveDueDate(2026, 1, 0)).toThrow(/due day/);
    expect(() => resolveDueDate(2026, 1, 32)).toThrow(/due day/);
    expect(() => compareDateOnly("2026-02-30", "2026-03-01")).toThrow(/date-only/);
    expect(() => differenceInCalendarDays("2026-03-02", "2026-03-01")).toThrow(/before/);
  });
});

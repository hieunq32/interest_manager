import { describe, expect, it } from "vitest";
import type { ReminderOverride, ReminderSettings } from "../domain/types";
import { DEFAULT_REMINDER_SETTINGS, resolveReminderSettings } from "./reminderSettings";

function settings(overrides: Partial<ReminderSettings> = {}): ReminderSettings {
  return {
    enabled: true,
    offsetDays: 1,
    time: "08:00",
    ...overrides,
  };
}

describe("reminder settings", () => {
  it("uses the enabled one-day 08:00 default settings", () => {
    expect(DEFAULT_REMINDER_SETTINGS).toEqual({ enabled: true, offsetDays: 1, time: "08:00" });
    expect(resolveReminderSettings(DEFAULT_REMINDER_SETTINGS)).toEqual({ enabled: true, offsetDays: 1, time: "08:00" });
  });

  it.each([
    ["enabled override", { enabled: true }, { enabled: true, offsetDays: 1, time: "08:00" }],
    ["disabled override", { enabled: false }, { enabled: false, offsetDays: 1, time: "08:00" }],
    ["custom offset", { offsetDays: 3 }, { enabled: true, offsetDays: 3, time: "08:00" }],
    ["custom time", { time: "17:45" }, { enabled: true, offsetDays: 1, time: "17:45" }],
  ] as const)("applies a per-loan %s", (_name: string, override: ReminderOverride, expected: ReminderSettings) => {
    expect(resolveReminderSettings(settings(), override)).toEqual(expected);
  });

  it.each([
    [{ offsetDays: -1 }, /offsetDays/],
    [{ offsetDays: 1.5 }, /offsetDays/],
    [{ time: "24:00" }, /time/],
    [{ time: "8:00" }, /time/],
  ] as const)("rejects invalid reminder settings %o", (override, error) => {
    expect(() => resolveReminderSettings(settings(), override)).toThrow(error);
  });
});

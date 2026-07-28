import type { ReminderOverride, ReminderSettings } from "../domain/types";

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  offsetDays: 1,
  time: "08:00",
};

function assertValidReminderSettings(settings: ReminderSettings): void {
  if (typeof settings.enabled !== "boolean") {
    throw new Error("enabled must be a boolean");
  }
  if (!Number.isInteger(settings.offsetDays) || settings.offsetDays < 0) {
    throw new Error("offsetDays must be a non-negative integer");
  }
  if (!TIME_PATTERN.test(settings.time)) {
    throw new Error("time must use HH:MM in 24-hour time");
  }
}

export function resolveReminderSettings(
  globalSettings: ReminderSettings,
  override?: ReminderOverride,
): ReminderSettings {
  const resolved = {
    ...globalSettings,
    ...override,
  };
  assertValidReminderSettings(resolved);
  return resolved;
}

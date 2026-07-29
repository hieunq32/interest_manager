import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReminderSettings as ReminderSettingsValue } from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { translateError, vi } from "../../i18n/vi";

export interface ReminderSettingsProps {
  value: ReminderSettingsValue;
  onSave(value: ReminderSettingsValue): Promise<void>;
}

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function ReminderSettings({ value, onSave }: ReminderSettingsProps) {
  const [enabled, setEnabled] = useState(value.enabled);
  const [offsetDays, setOffsetDays] = useState(String(value.offsetDays));
  const [time, setTime] = useState(value.time);
  const [error, setError] = useState("");

  useEffect(() => {
    setEnabled(value.enabled);
    setOffsetDays(String(value.offsetDays));
    setTime(value.time);
  }, [value]);

  const save = async () => {
    const trimmedOffsetDays = offsetDays.trim();
    if (!trimmedOffsetDays) {
      setError(translateError("Reminder offset must be a non-negative whole number", vi.errors.genericReminderSave));
      return;
    }

    const parsedOffsetDays = Number(trimmedOffsetDays);
    if (!Number.isInteger(parsedOffsetDays) || parsedOffsetDays < 0) {
      setError(translateError("Reminder offset must be a non-negative whole number", vi.errors.genericReminderSave));
      return;
    }
    if (!isValidTime(time)) {
      setError(translateError("Reminder time must use HH:MM", vi.errors.genericReminderSave));
      return;
    }

    try {
      await onSave({ enabled, offsetDays: parsedOffsetDays, time });
      setError("");
    } catch {
      setError(translateError("Could not save reminder settings", vi.errors.genericReminderSave));
    }
  };

  return (
    <section className="operation-panel" aria-labelledby="reminder-settings-heading">
      <h2 id="reminder-settings-heading">{vi.reminder.global}</h2>
      <label className="check-field"><input aria-label={vi.reminder.enabled} type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> {vi.reminder.enabled}</label>
      <Field label={vi.reminder.offsetDays} inputMode="numeric" value={offsetDays} onChange={(event) => setOffsetDays(event.target.value)} />
      <Field label={vi.reminder.time} type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Button icon={<Bell aria-hidden="true" size={18} />} variant="primary" onClick={() => void save()}>{vi.reminder.save}</Button>
    </section>
  );
}

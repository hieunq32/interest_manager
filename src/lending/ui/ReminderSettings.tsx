import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReminderSettings as ReminderSettingsValue } from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";

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
    const parsedOffsetDays = Number(offsetDays);
    if (!offsetDays.trim() || !Number.isInteger(parsedOffsetDays) || parsedOffsetDays < 0) {
      setError("Reminder offset must be a non-negative whole number");
      return;
    }
    if (!isValidTime(time)) {
      setError("Reminder time must use HH:MM");
      return;
    }

    try {
      await onSave({ enabled, offsetDays: parsedOffsetDays, time });
      setError("");
    } catch {
      setError("Could not save reminder settings");
    }
  };

  return (
    <section className="operation-panel" aria-labelledby="reminder-settings-heading">
      <h2 id="reminder-settings-heading">Global reminders</h2>
      <label className="check-field"><input aria-label="Enable global reminders" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable global reminders</label>
      <Field label="Reminder offset (days)" inputMode="numeric" value={offsetDays} onChange={(event) => setOffsetDays(event.target.value)} />
      <Field label="Reminder time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Button icon={<Bell aria-hidden="true" size={18} />} variant="primary" onClick={() => void save()}>Save reminder settings</Button>
    </section>
  );
}

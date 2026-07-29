import { Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReminderOverride } from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";

export interface LoanReminderOverrideFormProps {
  value?: ReminderOverride;
  onSave(value?: ReminderOverride): Promise<void>;
}

function initialOffset(value?: ReminderOverride): string {
  return String(value?.offsetDays ?? 1);
}

export function LoanReminderOverrideForm({ value, onSave }: LoanReminderOverrideFormProps) {
  const [useOverride, setUseOverride] = useState(value !== undefined);
  const [enabled, setEnabled] = useState(value?.enabled ?? true);
  const [offsetDays, setOffsetDays] = useState(() => initialOffset(value));
  const [time, setTime] = useState(value?.time ?? "08:00");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setUseOverride(value !== undefined);
    setEnabled(value?.enabled ?? true);
    setOffsetDays(initialOffset(value));
    setTime(value?.time ?? "08:00");
    setError("");
  }, [value]);

  const save = async () => {
    try {
      let nextValue: ReminderOverride | undefined;
      if (useOverride) {
        if (!offsetDays.trim()) {
          throw new Error("Loan reminder offset must be a non-negative whole number");
        }
        const parsedOffset = Number(offsetDays);
        if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
          throw new Error("Loan reminder offset must be a non-negative whole number");
        }
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
          throw new Error("Loan reminder time must use HH:MM");
        }
        nextValue = { enabled, offsetDays: parsedOffset, time };
      }

      setIsSaving(true);
      setError("");
      await onSave(nextValue);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save loan reminders");
    } finally {
      setIsSaving(false);
    }
  };

  const clear = async () => {
    setIsSaving(true);
    setError("");
    try {
      await onSave(undefined);
    } catch {
      setError("Could not clear loan reminder override");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="lending-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label className="check-field">
        <input type="checkbox" checked={useOverride} onChange={(event) => setUseOverride(event.target.checked)} />
        Use loan reminder override
      </label>
      {useOverride ? <div className="reminder-fields">
        <label className="check-field">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Enable loan reminders
        </label>
        <Field label="Loan reminder offset (days)" inputMode="numeric" value={offsetDays} onChange={(event) => setOffsetDays(event.target.value)} />
        <Field label="Loan reminder time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      </div> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="button-row">
        <Button icon={<Save aria-hidden="true" size={16} />} variant="primary" disabled={isSaving} type="submit">Save loan reminders</Button>
        {value ? <Button icon={<Trash2 aria-hidden="true" size={16} />} variant="danger" disabled={isSaving} onClick={() => void clear()}>Clear loan override</Button> : null}
      </div>
    </form>
  );
}

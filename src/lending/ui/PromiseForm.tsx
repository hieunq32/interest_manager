import { Save } from "lucide-react";
import { useState } from "react";
import { isDateOnly } from "../domain/dateRules";
import { assertValidMoney } from "../domain/money";
import type { PromiseToPay } from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";

export interface PromiseFormProps {
  loanId: string;
  scheduleEntryId: string;
  onSave(value: PromiseToPay): Promise<void>;
}

function parseOptionalAmount(value: string, fieldName: string): number | undefined {
  return value.trim() ? assertValidMoney(Number(value), fieldName) : undefined;
}

export function PromiseForm({ loanId, scheduleEntryId, onSave }: PromiseFormProps) {
  const [promisedDate, setPromisedDate] = useState("");
  const [promisedPrincipal, setPromisedPrincipal] = useState("");
  const [promisedInterest, setPromisedInterest] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    try {
      if (!isDateOnly(promisedDate)) {
        throw new Error("Promised date is required");
      }
      const nextNote = note.trim();
      if (!nextNote) {
        throw new Error("Promise note is required");
      }

      setIsSaving(true);
      setError("");
      const now = new Date().toISOString();
      await onSave({
        id: crypto.randomUUID(),
        loanId,
        scheduleEntryId,
        promisedDate,
        promisedPrincipal: parseOptionalAmount(promisedPrincipal, "Promised principal"),
        promisedInterest: parseOptionalAmount(promisedInterest, "Promised interest"),
        note: nextNote,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save promise");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="lending-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <Field label="Promised date" type="date" value={promisedDate} onChange={(event) => setPromisedDate(event.target.value)} />
      <Field label="Promised principal (VND)" inputMode="numeric" value={promisedPrincipal} onChange={(event) => setPromisedPrincipal(event.target.value)} />
      <Field label="Promised interest (VND)" inputMode="numeric" value={promisedInterest} onChange={(event) => setPromisedInterest(event.target.value)} />
      <label className="field" htmlFor="promise-note"><span>Promise note</span>
        <textarea id="promise-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Button icon={<Save aria-hidden="true" size={18} />} variant="primary" disabled={isSaving} type="submit">Save promise</Button>
    </form>
  );
}

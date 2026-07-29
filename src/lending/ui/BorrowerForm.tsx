import { Archive, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { translateError, vi } from "../../i18n/vi";
import type { Borrower } from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";

export interface BorrowerFormProps {
  value?: Borrower;
  onSave(value: Borrower): Promise<void>;
}

type BorrowerFormWithCancelProps = BorrowerFormProps & {
  onCancel?: () => void;
};

function newId(): string {
  return crypto.randomUUID();
}

function formValues(value?: Borrower) {
  return {
    displayName: value?.displayName ?? "",
    phone: value?.phone ?? "",
    note: value?.note ?? "",
  };
}

export function BorrowerForm({ value, onSave, onCancel }: BorrowerFormWithCancelProps) {
  const [form, setForm] = useState(() => formValues(value));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(formValues(value));
    setError("");
  }, [value]);

  const save = async (status = value?.status ?? "active") => {
    const displayName = form.displayName.trim();
    if (!displayName) {
      setError(vi.errors.displayNameRequired);
      return;
    }

    const now = new Date().toISOString();
    setIsSaving(true);
    setError("");
    try {
      await onSave({
        id: value?.id ?? newId(),
        displayName,
        phone: form.phone.trim() || undefined,
        note: form.note.trim() || undefined,
        status,
        createdAt: value?.createdAt ?? now,
        updatedAt: now,
      });
    } catch (error) {
      setError(translateError(error, vi.errors.genericBorrowerSave));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="lending-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <Field label={vi.borrower.displayName} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
      <Field label={vi.borrower.phone} type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
      <label className="field" htmlFor="borrower-note">
        <span>{vi.borrower.note}</span>
        <textarea id="borrower-note" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="button-row">
        <Button icon={<Save aria-hidden="true" size={18} />} variant="primary" disabled={isSaving} type="submit">
          {vi.borrower.save}
        </Button>
        {value?.status === "active" ? (
          <Button icon={<Archive aria-hidden="true" size={18} />} disabled={isSaving} onClick={() => void save("archived")}>
            {vi.borrower.archive}
          </Button>
        ) : null}
        {onCancel ? <Button onClick={onCancel}>{vi.common.cancel}</Button> : null}
      </div>
    </form>
  );
}

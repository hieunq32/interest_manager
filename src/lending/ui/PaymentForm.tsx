import { Save } from "lucide-react";
import { useState } from "react";
import { isDateOnly } from "../domain/dateRules";
import { assertValidMoney } from "../domain/money";
import type { PaymentTransaction } from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { translateError, vi } from "../../i18n/vi";

export interface PaymentFormProps {
  loanId: string;
  scheduleEntryId: string;
  onSave(value: PaymentTransaction): Promise<void>;
}

function parseAmount(value: string, fieldName: string): number {
  return assertValidMoney(value.trim() ? Number(value) : 0, fieldName);
}

export function PaymentForm({ loanId, scheduleEntryId, onSave }: PaymentFormProps) {
  const [receivedAt, setReceivedAt] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [interestAmount, setInterestAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    try {
      if (!isDateOnly(receivedAt)) {
        throw new Error("Received date is required");
      }
      const nextPrincipalAmount = parseAmount(principalAmount, "Principal received");
      const nextInterestAmount = parseAmount(interestAmount, "Interest received");
      if (nextPrincipalAmount === 0 && nextInterestAmount === 0) {
        throw new Error("At least one received amount must be positive");
      }

      setIsSaving(true);
      setError("");
      await onSave({
        id: crypto.randomUUID(),
        loanId,
        scheduleEntryId,
        receivedAt,
        principalAmount: nextPrincipalAmount,
        interestAmount: nextInterestAmount,
        note: note.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
    } catch (cause) {
      setError(translateError(cause, vi.errors.genericPaymentSave));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="lending-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <Field label={vi.payment.receivedDate} type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
      <Field label={vi.payment.principalReceived} inputMode="numeric" value={principalAmount} onChange={(event) => setPrincipalAmount(event.target.value)} />
      <Field label={vi.payment.interestReceived} inputMode="numeric" value={interestAmount} onChange={(event) => setInterestAmount(event.target.value)} />
      <label className="field" htmlFor="payment-note"><span>{vi.common.note}</span>
        <textarea id="payment-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Button icon={<Save aria-hidden="true" size={18} />} variant="primary" disabled={isSaving} type="submit">{vi.payment.save}</Button>
    </form>
  );
}

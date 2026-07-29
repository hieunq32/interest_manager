import { Save, X } from "lucide-react";
import { useState } from "react";
import { translateError, vi } from "../../i18n/vi";
import { isDateOnly } from "../domain/dateRules";
import { assertValidMoney } from "../domain/money";
import { buildPaymentCancellation, buildPaymentCorrection } from "../domain/paymentCorrections";
import type { PaymentSnapshot, PaymentTransaction } from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { formatMoneyVnd } from "./lendingLabels";

export interface PaymentCorrectionFormProps {
  payment: PaymentTransaction;
  mode: "edit" | "void";
  onSave(next: PaymentSnapshot | undefined, reason: string): Promise<void>;
  onCancel(): void;
}

function parseAmount(value: string, fieldName: string): number {
  return assertValidMoney(value.trim() ? Number(value) : 0, fieldName);
}

export function PaymentCorrectionForm({ payment, mode, onSave, onCancel }: PaymentCorrectionFormProps) {
  const [receivedAt, setReceivedAt] = useState(payment.receivedAt);
  const [principalAmount, setPrincipalAmount] = useState(String(payment.principalAmount));
  const [interestAmount, setInterestAmount] = useState(String(payment.interestAmount));
  const [note, setNote] = useState(payment.note ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    try {
      const trimmedReason = reason.trim();
      if (mode === "void") {
        buildPaymentCancellation({
          payment,
          reason: trimmedReason,
          adjustmentId: "validation",
          now: payment.updatedAt ?? payment.createdAt,
        });
        setIsSaving(true);
        setError("");
        await onSave(undefined, trimmedReason);
        return;
      }

      if (!isDateOnly(receivedAt)) {
        throw new Error("receivedAt must be a valid DateOnly");
      }
      const next: PaymentSnapshot = {
        scheduleEntryId: payment.scheduleEntryId,
        receivedAt,
        principalAmount: parseAmount(principalAmount, "Principal received"),
        interestAmount: parseAmount(interestAmount, "Interest received"),
        note: note.trim() || undefined,
      };
      buildPaymentCorrection({
        payment,
        next,
        reason: trimmedReason,
        adjustmentId: "validation",
        replacementId: "validation",
        now: payment.updatedAt ?? payment.createdAt,
      });
      setIsSaving(true);
      setError("");
      await onSave(next, trimmedReason);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "reason is required"
        ? vi.errors.requiredReason
        : translateError(cause, vi.errors.genericPaymentSave));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="lending-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      {mode === "edit" ? <>
        <Field label={vi.payment.receivedDate} type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
        <Field label={vi.payment.principalReceived} inputMode="numeric" value={principalAmount} onChange={(event) => setPrincipalAmount(event.target.value)} />
        <Field label={vi.payment.interestReceived} inputMode="numeric" value={interestAmount} onChange={(event) => setInterestAmount(event.target.value)} />
        <label className="field" htmlFor="payment-correction-note"><span>{vi.common.note}</span>
          <textarea id="payment-correction-note" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </> : <section aria-label={vi.payment.history}>
        <p>{payment.receivedAt}</p>
        <p>{formatMoneyVnd(payment.principalAmount)}</p>
        <p>{formatMoneyVnd(payment.interestAmount)}</p>
        {payment.note ? <p>{payment.note}</p> : null}
      </section>}
      <label className="field" htmlFor="payment-correction-reason"><span>{vi.payment.correctionReason}</span>
        <textarea id="payment-correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="button-row">
        <Button icon={<X aria-hidden="true" size={18} />} onClick={onCancel}>{vi.common.cancel}</Button>
        <Button icon={<Save aria-hidden="true" size={18} />} variant={mode === "void" ? "danger" : "primary"} disabled={isSaving} type="submit">
          {mode === "void" ? vi.payment.confirmVoid : vi.payment.saveCorrection}
        </Button>
      </div>
    </form>
  );
}

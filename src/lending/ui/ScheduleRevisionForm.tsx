import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { isDateOnly } from "../domain/dateRules";
import { type RevisionInput, validateRevisionReason } from "../domain/revisions";
import type { CalculationModel, PartialPeriodInterestMode, RateUnit, ScheduleVersion } from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { translateError, vi } from "../../i18n/vi";
import { calculationModelLabels, partialPeriodInterestModeLabels, rateUnitLabels } from "./lendingLabels";

export interface ScheduleRevisionFormProps {
  current: ScheduleVersion;
  onSave(input: RevisionInput): Promise<void>;
}

type RevisionFormState = {
  effectiveDate: string;
  calculationModel: CalculationModel;
  principalBase: string;
  disbursementDate: string;
  monthlyDueDay: string;
  maturityDate: string;
  ratePercent: string;
  rateUnit: RateUnit;
  partialPeriodInterestMode: PartialPeriodInterestMode;
  adjustmentReason: string;
};

function formValues(current: ScheduleVersion): RevisionFormState {
  return {
    effectiveDate: current.effectiveDate,
    calculationModel: current.calculationModel,
    principalBase: String(current.principalBase),
    disbursementDate: current.disbursementDate,
    monthlyDueDay: String(current.monthlyDueDay),
    maturityDate: current.maturityDate,
    ratePercent: String(current.rateValue * 100),
    rateUnit: current.rateUnit,
    partialPeriodInterestMode: current.partialPeriodInterestMode,
    adjustmentReason: "",
  };
}

function parseDueDay(value: string): number {
  const dueDay = Number(value);
  if (!Number.isSafeInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("Monthly due day must be between 1 and 31");
  }
  return dueDay;
}

function revisionInput(current: ScheduleVersion, form: RevisionFormState): RevisionInput {
  if (!isDateOnly(form.effectiveDate) || !isDateOnly(form.disbursementDate) || !isDateOnly(form.maturityDate)) {
    throw new Error("Effective, disbursement, and maturity dates are required");
  }
  const principalBase = Number(form.principalBase);
  if (!form.principalBase.trim() || !Number.isSafeInteger(principalBase) || principalBase <= 0) {
    throw new Error("Principal base must be a positive whole number");
  }
  const monthlyDueDay = parseDueDay(form.monthlyDueDay);
  const ratePercent = Number(form.ratePercent);
  if (!form.ratePercent.trim() || !Number.isFinite(ratePercent) || ratePercent < 0) {
    throw new Error("Rate must be a non-negative number");
  }
  const rateValue = ratePercent / 100;

  const changes = {
    ...(form.calculationModel !== current.calculationModel ? { calculationModel: form.calculationModel } : {}),
    ...(principalBase !== current.principalBase ? { principalBase } : {}),
    ...(form.disbursementDate !== current.disbursementDate ? { disbursementDate: form.disbursementDate } : {}),
    ...(monthlyDueDay !== current.monthlyDueDay ? { monthlyDueDay } : {}),
    ...(form.maturityDate !== current.maturityDate ? { maturityDate: form.maturityDate } : {}),
    ...(rateValue !== current.rateValue ? { rateValue } : {}),
    ...(form.rateUnit !== current.rateUnit ? { rateUnit: form.rateUnit } : {}),
    ...(form.partialPeriodInterestMode !== current.partialPeriodInterestMode ? { partialPeriodInterestMode: form.partialPeriodInterestMode } : {}),
  };
  const adjustmentReason = form.adjustmentReason.trim() || undefined;
  const next = { ...current, ...changes };
  validateRevisionReason({ previous: current, next, adjustmentReason });

  return { previous: current, effectiveDate: form.effectiveDate, changes, adjustmentReason, createdAt: new Date().toISOString() };
}

export function ScheduleRevisionForm({ current, onSave }: ScheduleRevisionFormProps) {
  const [form, setForm] = useState(() => formValues(current));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(formValues(current));
    setError("");
  }, [current]);

  const update = <K extends keyof RevisionFormState>(key: K, nextValue: RevisionFormState[K]) => {
    setForm((currentValue) => ({ ...currentValue, [key]: nextValue }));
  };

  const save = async () => {
    try {
      const input = revisionInput(current, form);
      setIsSaving(true);
      setError("");
      await onSave(input);
    } catch (cause) {
      setError(translateError(cause, vi.errors.genericRevisionSave));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="lending-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <Field label="Ngày áp dụng" type="date" value={form.effectiveDate} onChange={(event) => update("effectiveDate", event.target.value)} />
      <label className="field" htmlFor="revision-calculation-model"><span>{vi.loan.calculationModel}</span>
        <select id="revision-calculation-model" value={form.calculationModel} onChange={(event) => update("calculationModel", event.target.value as CalculationModel)}>
          {Object.entries(calculationModelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <Field label={vi.loan.principal} inputMode="numeric" value={form.principalBase} onChange={(event) => update("principalBase", event.target.value)} />
      <Field label={vi.loan.disbursementDate} type="date" value={form.disbursementDate} onChange={(event) => update("disbursementDate", event.target.value)} />
      <Field label={vi.loan.monthlyDueDay} inputMode="numeric" value={form.monthlyDueDay} onChange={(event) => update("monthlyDueDay", event.target.value)} />
      <Field label={vi.loan.maturityDate} type="date" value={form.maturityDate} onChange={(event) => update("maturityDate", event.target.value)} />
      <Field label={vi.loan.rate} inputMode="decimal" value={form.ratePercent} onChange={(event) => update("ratePercent", event.target.value)} />
      <label className="field" htmlFor="revision-rate-unit"><span>{vi.loan.rateUnit}</span>
        <select id="revision-rate-unit" value={form.rateUnit} onChange={(event) => update("rateUnit", event.target.value as RateUnit)}>
          {Object.entries(rateUnitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="field" htmlFor="revision-partial-period-interest"><span>{vi.loan.partialPeriod}</span>
        <select id="revision-partial-period-interest" value={form.partialPeriodInterestMode} onChange={(event) => update("partialPeriodInterestMode", event.target.value as PartialPeriodInterestMode)}>
          {Object.entries(partialPeriodInterestModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="field" htmlFor="adjustment-reason"><span>Lý do điều chỉnh</span>
        <textarea id="adjustment-reason" value={form.adjustmentReason} onChange={(event) => update("adjustmentReason", event.target.value)} />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Button icon={<Save aria-hidden="true" size={18} />} variant="primary" disabled={isSaving} type="submit">Lưu phiên bản lịch mới</Button>
    </form>
  );
}

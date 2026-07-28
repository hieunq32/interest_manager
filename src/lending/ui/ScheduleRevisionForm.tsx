import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { isDateOnly } from "../domain/dateRules";
import { assertValidMoney } from "../domain/money";
import { type RevisionInput, validateRevisionReason } from "../domain/revisions";
import type { CalculationModel, PartialPeriodInterestMode, RateUnit, ScheduleVersion } from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
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
  rateValue: string;
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
    rateValue: String(current.rateValue),
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
  const principalBase = assertValidMoney(Number(form.principalBase), "Principal base");
  const monthlyDueDay = parseDueDay(form.monthlyDueDay);
  const rateValue = Number(form.rateValue);
  if (!Number.isFinite(rateValue) || rateValue < 0) {
    throw new Error("Rate must be a non-negative number");
  }

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
      setError(cause instanceof Error ? cause.message : "Could not save revision");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="lending-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <Field label="Effective date" type="date" value={form.effectiveDate} onChange={(event) => update("effectiveDate", event.target.value)} />
      <label className="field" htmlFor="revision-calculation-model"><span>Calculation model</span>
        <select id="revision-calculation-model" value={form.calculationModel} onChange={(event) => update("calculationModel", event.target.value as CalculationModel)}>
          {Object.entries(calculationModelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <Field label="Principal base (VND)" inputMode="numeric" value={form.principalBase} onChange={(event) => update("principalBase", event.target.value)} />
      <Field label="Disbursement date" type="date" value={form.disbursementDate} onChange={(event) => update("disbursementDate", event.target.value)} />
      <Field label="Monthly due day" inputMode="numeric" value={form.monthlyDueDay} onChange={(event) => update("monthlyDueDay", event.target.value)} />
      <Field label="Maturity date" type="date" value={form.maturityDate} onChange={(event) => update("maturityDate", event.target.value)} />
      <Field label="Rate (decimal)" inputMode="decimal" value={form.rateValue} onChange={(event) => update("rateValue", event.target.value)} />
      <label className="field" htmlFor="revision-rate-unit"><span>Rate unit</span>
        <select id="revision-rate-unit" value={form.rateUnit} onChange={(event) => update("rateUnit", event.target.value as RateUnit)}>
          {Object.entries(rateUnitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="field" htmlFor="revision-partial-period-interest"><span>Partial-period interest</span>
        <select id="revision-partial-period-interest" value={form.partialPeriodInterestMode} onChange={(event) => update("partialPeriodInterestMode", event.target.value as PartialPeriodInterestMode)}>
          {Object.entries(partialPeriodInterestModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="field" htmlFor="adjustment-reason"><span>Adjustment reason</span>
        <textarea id="adjustment-reason" value={form.adjustmentReason} onChange={(event) => update("adjustmentReason", event.target.value)} />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Button icon={<Save aria-hidden="true" size={18} />} variant="primary" disabled={isSaving} type="submit">Save revision</Button>
    </form>
  );
}

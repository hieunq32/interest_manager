import { ArrowLeft, Check, Eye, Save } from "lucide-react";
import { useState } from "react";
import { compareDateOnly, isDateOnly } from "../domain/dateRules";
import { generateSchedule } from "../domain/scheduleGenerator";
import type {
  CalculationModel,
  DateOnly,
  MoneyVnd,
  PartialPeriodInterestMode,
  RateUnit,
  ReminderOverride,
  ScheduleEntry,
  ScheduleVersion,
} from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { translateError, vi } from "../../i18n/vi";
import { calculationModelLabels, formatMoneyVnd, partialPeriodInterestModeLabels, rateUnitLabels } from "./lendingLabels";

export interface LoanDraft {
  borrowerId: string;
  calculationModel: CalculationModel;
  originalPrincipal: MoneyVnd;
  disbursementDate: DateOnly;
  monthlyDueDay: number;
  maturityDate: DateOnly;
  rateValue: number;
  rateUnit: RateUnit;
  partialPeriodInterestMode: PartialPeriodInterestMode;
  reminderOverride?: ReminderOverride;
  note?: string;
}

export interface LoanFormProps {
  borrowerId: string;
  onSave(input: LoanDraft): Promise<void>;
}

type LoanFormWithCancelProps = LoanFormProps & {
  onCancel?: () => void;
};

type LoanFormState = {
  principal: string;
  disbursementDate: string;
  calculationModel: CalculationModel;
  monthlyDueDay: string;
  maturityDate: string;
  ratePercent: string;
  rateUnit: RateUnit;
  partialPeriodInterestMode: PartialPeriodInterestMode;
  useReminderOverride: boolean;
  reminderEnabled: boolean;
  reminderOffsetDays: string;
  reminderTime: string;
  note: string;
};

const initialState: LoanFormState = {
  principal: "",
  disbursementDate: "",
  calculationModel: "interest-only-final-principal",
  monthlyDueDay: "1",
  maturityDate: "",
  ratePercent: "",
  rateUnit: "monthly",
  partialPeriodInterestMode: "full-period",
  useReminderOverride: false,
  reminderEnabled: true,
  reminderOffsetDays: "1",
  reminderTime: "08:00",
  note: "",
};

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function parsePositiveInteger(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive whole number`);
  }
  return parsed;
}

function parseLoanDraft(borrowerId: string, form: LoanFormState): LoanDraft {
  const originalPrincipal = parsePositiveInteger(form.principal, "Principal") as MoneyVnd;
  const monthlyDueDay = parsePositiveInteger(form.monthlyDueDay, "Monthly due day");
  if (monthlyDueDay > 31) {
    throw new Error("Monthly due day must be between 1 and 31");
  }
  if (!isDateOnly(form.disbursementDate) || !isDateOnly(form.maturityDate)) {
    throw new Error("Disbursement and maturity dates are required");
  }
  if (compareDateOnly(form.maturityDate, form.disbursementDate) <= 0) {
    throw new Error("Maturity date must be after disbursement date");
  }
  const ratePercent = Number(form.ratePercent);
  if (!form.ratePercent.trim() || !Number.isFinite(ratePercent) || ratePercent < 0) {
    throw new Error("Rate must be a non-negative number");
  }
  const reminderOverride = parseReminderOverride(form);

  return {
    borrowerId,
    calculationModel: form.calculationModel,
    originalPrincipal,
    disbursementDate: form.disbursementDate,
    monthlyDueDay,
    maturityDate: form.maturityDate,
    rateValue: ratePercent / 100,
    rateUnit: form.rateUnit,
    partialPeriodInterestMode: form.partialPeriodInterestMode,
    reminderOverride,
    note: form.note.trim() || undefined,
  };
}

function parseReminderOverride(form: LoanFormState): ReminderOverride | undefined {
  if (!form.useReminderOverride) {
    return undefined;
  }
  if (!form.reminderOffsetDays.trim()) {
    throw new Error("Reminder offset must be a non-negative whole number");
  }
  const offsetDays = Number(form.reminderOffsetDays);
  if (!Number.isInteger(offsetDays) || offsetDays < 0) {
    throw new Error("Reminder offset must be a non-negative whole number");
  }
  if (!isValidTime(form.reminderTime)) {
    throw new Error("Reminder time must use HH:MM");
  }
  return { enabled: form.reminderEnabled, offsetDays, time: form.reminderTime };
}

function previewVersion(draft: LoanDraft): ScheduleVersion {
  return {
    id: "preview-version",
    loanId: "preview-loan",
    versionNumber: 1,
    effectiveDate: draft.disbursementDate,
    calculationModel: draft.calculationModel,
    principalBase: draft.originalPrincipal,
    disbursementDate: draft.disbursementDate,
    monthlyDueDay: draft.monthlyDueDay,
    maturityDate: draft.maturityDate,
    rateValue: draft.rateValue,
    rateUnit: draft.rateUnit,
    partialPeriodInterestMode: draft.partialPeriodInterestMode,
    createdAt: "1970-01-01T00:00:00.000Z",
  };
}

export function LoanForm({ borrowerId, onSave, onCancel }: LoanFormWithCancelProps) {
  const [form, setForm] = useState<LoanFormState>(initialState);
  const [draft, setDraft] = useState<LoanDraft>();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const update = <K extends keyof LoanFormState>(key: K, value: LoanFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDraft(undefined);
    setEntries([]);
  };

  const createPreview = () => {
    try {
      const nextDraft = parseLoanDraft(borrowerId, form);
      setDraft(nextDraft);
      setEntries(generateSchedule(previewVersion(nextDraft)));
      setError("");
    } catch (cause) {
      setError(translateError(cause, vi.errors.previewFailed));
    }
  };

  const save = async () => {
    if (!draft) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(draft);
    } catch {
      setError(translateError("Could not save loan", vi.errors.genericLoanSave));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="route-panel" aria-labelledby="loan-form-heading">
      <div className="route-heading">
        {onCancel ? <Button icon={<ArrowLeft aria-hidden="true" size={18} />} onClick={onCancel}>{vi.borrower.title}</Button> : null}
      </div>
      <h2 id="loan-form-heading">{vi.loan.new}</h2>
      <form className="lending-form" onSubmit={(event) => { event.preventDefault(); createPreview(); }}>
        <Field label={vi.loan.principal} inputMode="numeric" value={form.principal} onChange={(event) => update("principal", event.target.value)} />
        <Field label={vi.loan.disbursementDate} type="date" value={form.disbursementDate} onChange={(event) => update("disbursementDate", event.target.value)} />
        <label className="field" htmlFor="calculation-model"><span>{vi.loan.calculationModel}</span>
          <select id="calculation-model" value={form.calculationModel} onChange={(event) => update("calculationModel", event.target.value as CalculationModel)}>
            {Object.entries(calculationModelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <Field label={vi.loan.monthlyDueDay} inputMode="numeric" value={form.monthlyDueDay} onChange={(event) => update("monthlyDueDay", event.target.value)} />
        <Field label={vi.loan.maturityDate} type="date" value={form.maturityDate} onChange={(event) => update("maturityDate", event.target.value)} />
        <Field label={vi.loan.rate} inputMode="decimal" value={form.ratePercent} onChange={(event) => update("ratePercent", event.target.value)} />
        <label className="field" htmlFor="rate-unit"><span>{vi.loan.rateUnit}</span>
          <select id="rate-unit" value={form.rateUnit} onChange={(event) => update("rateUnit", event.target.value as RateUnit)}>
            {Object.entries(rateUnitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="partial-period-interest"><span>{vi.loan.partialPeriod}</span>
          <select id="partial-period-interest" value={form.partialPeriodInterestMode} onChange={(event) => update("partialPeriodInterestMode", event.target.value as PartialPeriodInterestMode)}>
            {Object.entries(partialPeriodInterestModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="check-field"><input type="checkbox" checked={form.useReminderOverride} onChange={(event) => update("useReminderOverride", event.target.checked)} /> {vi.reminder.useOverride}</label>
        {form.useReminderOverride ? <div className="reminder-fields">
          <label className="check-field"><input type="checkbox" checked={form.reminderEnabled} onChange={(event) => update("reminderEnabled", event.target.checked)} /> {vi.reminder.enabled}</label>
          <Field label={vi.reminder.offsetDays} inputMode="numeric" value={form.reminderOffsetDays} onChange={(event) => update("reminderOffsetDays", event.target.value)} />
          <Field label={vi.reminder.time} type="time" value={form.reminderTime} onChange={(event) => update("reminderTime", event.target.value)} />
        </div> : null}
        <label className="field" htmlFor="loan-note"><span>{vi.common.note}</span>
          <textarea id="loan-note" value={form.note} onChange={(event) => update("note", event.target.value)} />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <Button icon={<Eye aria-hidden="true" size={18} />} variant="primary" type="submit">{vi.loan.preview}</Button>
      </form>
      {draft ? <section className="schedule-preview" aria-labelledby="schedule-preview-heading">
        <h3 id="schedule-preview-heading">{vi.loan.preview}</h3>
        <table>
          <thead><tr><th>{vi.loan.previewDueDate}</th><th>{vi.loan.previewPrincipal}</th><th>{vi.loan.previewInterest}</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.id}><td>{entry.dueDate}</td><td>{formatMoneyVnd(entry.expectedPrincipal)}</td><td>{formatMoneyVnd(entry.expectedInterest)}</td></tr>)}</tbody>
        </table>
        <Button icon={<Check aria-hidden="true" size={18} />} variant="primary" disabled={isSaving} onClick={() => void save()}>
          {vi.loan.confirmSave}
        </Button>
      </section> : null}
    </section>
  );
}

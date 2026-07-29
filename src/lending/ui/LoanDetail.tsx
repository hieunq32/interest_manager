import { ArrowLeft, CalendarDays, Check, CircleDollarSign, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  calculateEntryStatus,
  calculateEntryTotals,
  calculateLoanSummary,
  selectCurrentLoanEntries,
} from "../domain/ledger";
import { evaluateSettlementEligibility } from "../domain/loanLifecycle";
import type { RevisionInput } from "../domain/revisions";
import type { DateOnly, Loan, LoanLifecycleEvent, PaymentAdjustment, PaymentSnapshot, PaymentTransaction, PromiseToPay, ReminderOverride, ScheduleEntry, ScheduleVersion } from "../domain/types";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { PaymentForm } from "./PaymentForm";
import { PaymentCorrectionForm } from "./PaymentCorrectionForm";
import { PromiseForm } from "./PromiseForm";
import { ScheduleRevisionForm } from "./ScheduleRevisionForm";
import { LoanReminderOverrideForm } from "./LoanReminderOverrideForm";
import { formatMoneyVnd } from "./lendingLabels";
import { vi } from "../../i18n/vi";

export interface LoanDetailProps {
  loan: Loan;
  borrowerName: string;
  versions: ScheduleVersion[];
  entries: ScheduleEntry[];
  payments: PaymentTransaction[];
  paymentHistory: PaymentTransaction[];
  paymentAdjustments: PaymentAdjustment[];
  promises: PromiseToPay[];
  today: string;
  lifecycleEvents: LoanLifecycleEvent[];
  calendarExportVersionId?: string;
  onBack(): void;
  onSavePayment(value: PaymentTransaction): Promise<void>;
  onEditPayment(payment: PaymentTransaction, next: PaymentSnapshot, reason: string): Promise<void>;
  onCancelPayment(payment: PaymentTransaction, reason: string): Promise<void>;
  onSavePromise(value: PromiseToPay): Promise<void>;
  onUpdatePromise(value: PromiseToPay): Promise<void>;
  onSaveRevision(input: RevisionInput): Promise<void>;
  onSaveReminderOverride(value?: ReminderOverride): Promise<void>;
  onExportCalendar(versionId: string): void;
  onSettle(settlementDate: DateOnly): Promise<void>;
  onReopen(reason: string): Promise<void>;
}

export interface PaymentHistoryView {
  payment: PaymentTransaction;
  adjustments: PaymentAdjustment[];
}

type EntryForm = { kind: "payment" | "promise"; entryId: string } | undefined;
type PaymentCorrection = { payment: PaymentTransaction; mode: "edit" | "void" } | undefined;

function entryStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    upcoming: vi.status.upcoming,
    due: vi.status.due,
    promised: vi.status.promised,
    "partially-paid": vi.status.partiallyPaid,
    overdue: vi.status.overdue,
    paid: vi.status.paid,
    open: vi.status.open,
    fulfilled: vi.status.fulfilled,
    cancelled: vi.status.cancelled,
    expired: vi.status.expired,
  };
  return labels[value] ?? value.replaceAll("-", " ");
}

export function LoanDetail({
  loan,
  borrowerName,
  versions,
  entries,
  payments,
  paymentHistory,
  paymentAdjustments,
  promises,
  today,
  lifecycleEvents = [],
  calendarExportVersionId,
  onBack,
  onSavePayment,
  onEditPayment,
  onCancelPayment,
  onSavePromise,
  onUpdatePromise,
  onSaveRevision,
  onSaveReminderOverride,
  onExportCalendar,
  onSettle,
  onReopen,
}: LoanDetailProps) {
  const [entryForm, setEntryForm] = useState<EntryForm>();
  const [paymentCorrection, setPaymentCorrection] = useState<PaymentCorrection>();
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [settlementDate, setSettlementDate] = useState(today);
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenError, setReopenError] = useState("");
  const activeVersion = versions.find((version) => version.id === loan.defaultScheduleVersionId);
  const currentEntries = selectCurrentLoanEntries({
    entries,
    versions,
    activeScheduleVersionId: loan.defaultScheduleVersionId,
  });
  const currentEntryIds = new Set(currentEntries.map((entry) => entry.id));
  const activeTerms = activeVersion ?? {
    disbursementDate: loan.disbursementDate,
    maturityDate: loan.maturityDate,
  };
  const summary = calculateLoanSummary({ loanId: loan.id, entries: currentEntries, payments, promises, today });
  const settlementEligibility = evaluateSettlementEligibility(summary);
  const isSettled = loan.status === "settled";
  const calendarState = calendarExportVersionId === loan.defaultScheduleVersionId
    ? vi.calendar.matches
    : calendarExportVersionId
      ? vi.calendar.stale
      : vi.calendar.notExported;
  const paymentHistoryViews: PaymentHistoryView[] = paymentHistory
    .filter((payment) => payment.status === "adjusted" || payment.status === "voided")
    .map((payment) => ({
      payment,
      adjustments: paymentAdjustments.filter((adjustment) => adjustment.paymentId === payment.id),
    }));

  const changePromiseStatus = async (promise: PromiseToPay, status: "fulfilled" | "cancelled") => {
    await onUpdatePromise({ ...promise, status, updatedAt: new Date().toISOString() });
  };

  const savePayment = async (value: PaymentTransaction) => {
    await onSavePayment(value);
    setEntryForm(undefined);
  };

  const savePromise = async (value: PromiseToPay) => {
    await onSavePromise(value);
    setEntryForm(undefined);
  };

  const saveRevision = async (input: RevisionInput) => {
    await onSaveRevision(input);
    setShowRevisionForm(false);
  };

  const savePaymentCorrection = async (next: PaymentSnapshot | undefined, reason: string) => {
    if (!paymentCorrection) return;
    if (paymentCorrection.mode === "void") {
      if (!window.confirm(vi.payment.confirmVoid)) return;
      await onCancelPayment(paymentCorrection.payment, reason);
    } else if (next) {
      await onEditPayment(paymentCorrection.payment, next, reason);
    }
    setPaymentCorrection(undefined);
  };

  const settle = async () => {
    await onSettle(settlementDate);
  };

  const reopen = async () => {
    const reason = reopenReason.trim();
    if (!reason) {
      setReopenError(vi.errors.reopenReasonRequired);
      return;
    }
    setReopenError("");
    await onReopen(reason);
  };

  return (
    <section className="route-panel" aria-labelledby="loan-detail-heading">
      <div className="route-heading">
        <Button icon={<ArrowLeft aria-hidden="true" size={18} />} onClick={onBack}>{vi.borrower.title}</Button>
        {!isSettled ? <Button icon={<Pencil aria-hidden="true" size={18} />} onClick={() => setShowRevisionForm((value) => !value)}>{vi.revision.title}</Button> : null}
        {!isSettled ? <Button icon={<CalendarDays aria-hidden="true" size={18} />} variant="primary" onClick={() => onExportCalendar(loan.defaultScheduleVersionId)}>{vi.calendar.export}</Button> : null}
      </div>
      <h2 id="loan-detail-heading">{vi.loan.details}</h2>
      <p>{borrowerName}</p>
      <p>{activeTerms.disbursementDate} {vi.common.to} {activeTerms.maturityDate}</p>

      <section className="schedule-preview" aria-labelledby="loan-summary-heading">
        <h3 id="loan-summary-heading">{vi.loan.currentBalance}</h3>
        <p>{vi.loan.outstandingPrincipal}: {formatMoneyVnd(summary.outstandingPrincipal)}</p>
        <p>{vi.loan.outstandingInterest}: {formatMoneyVnd(summary.outstandingInterest)}</p>
        <p>{vi.loan.nextDueDate}: {summary.nextDueDate ?? vi.common.none}</p>
        <p>{vi.status.due}: {summary.dueToday}</p>
        <p>{vi.status.upcoming}: {summary.dueSoon}</p>
        <p>{vi.status.overdue}: {summary.overdue}</p>
      </section>

      <section className="schedule-preview" aria-labelledby="calendar-export-heading">
        <h3 id="calendar-export-heading">{vi.calendar.exportHeading}</h3>
        <p>{calendarState}</p>
      </section>

      <section className="schedule-preview" aria-labelledby="loan-reminders-heading">
        <h3 id="loan-reminders-heading">{vi.reminder.loan}</h3>
        {!isSettled ? <LoanReminderOverrideForm value={loan.reminderOverride} onSave={onSaveReminderOverride} /> : <p>{vi.loan.readOnly}</p>}
      </section>

      {!isSettled && showRevisionForm && activeVersion ? <section className="schedule-preview" aria-labelledby="revision-heading">
        <h3 id="revision-heading">{vi.revision.newVersion}</h3>
        <ScheduleRevisionForm current={activeVersion} onSave={saveRevision} />
      </section> : null}

      <section className="schedule-preview" aria-labelledby="versions-heading">
        <h3 id="versions-heading">{vi.loan.versions}</h3>
        {versions.map((version) => {
          const isActive = version.id === loan.defaultScheduleVersionId;
          const versionEntries = entries.filter((entry) => entry.scheduleVersionId === version.id);
          return <section key={version.id} aria-label={`${vi.loan.versions} ${version.versionNumber}`}>
            <h4>{vi.loan.versions} {version.versionNumber} ({isActive ? vi.loan.active : vi.loan.readOnly})</h4>
            <p>{vi.revision.effectiveDate}: {version.effectiveDate}</p>
            {version.adjustmentReason ? <p>{vi.revision.adjustmentReason}: {version.adjustmentReason}</p> : null}
            <div className="schedule-preview">
              <table>
                <thead><tr><th>{vi.loan.originalDue}</th><th>{vi.common.status}</th><th>{vi.loan.principal} ({vi.payment.expected} / {vi.payment.received} / {vi.payment.outstanding})</th><th>{vi.loan.interest} ({vi.payment.expected} / {vi.payment.received} / {vi.payment.outstanding})</th><th>{vi.common.actions}</th></tr></thead>
                <tbody>{versionEntries.map((entry) => {
                  const totals = calculateEntryTotals(entry, payments);
                  const status = calculateEntryStatus({ entry, payments, promises, today });
                  const isCurrent = currentEntryIds.has(entry.id);
                  return <tr key={entry.id}>
                    <td>{vi.loan.originalDue}: {entry.dueDate}</td>
                    <td>{entryStatusLabel(status)}</td>
                    <td>{formatMoneyVnd(entry.expectedPrincipal)} / {formatMoneyVnd(totals.receivedPrincipal)} / {formatMoneyVnd(totals.outstandingPrincipal)}</td>
                    <td>{formatMoneyVnd(entry.expectedInterest)} / {formatMoneyVnd(totals.receivedInterest)} / {formatMoneyVnd(totals.outstandingInterest)}</td>
                    <td>{isCurrent ? <div className="button-row">
                      {!isSettled ? <Button icon={<CircleDollarSign aria-hidden="true" size={16} />} onClick={() => setEntryForm({ kind: "payment", entryId: entry.id })}>{vi.payment.record}</Button> : null}
                      {!isSettled ? <Button icon={<CalendarDays aria-hidden="true" size={16} />} onClick={() => setEntryForm({ kind: "promise", entryId: entry.id })}>{vi.promise.record}</Button> : null}
                    </div> : vi.loan.readOnly}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </section>;
        })}
      </section>

      {entryForm ? <section className="schedule-preview" aria-labelledby="entry-form-heading">
        <h3 id="entry-form-heading">{entryForm.kind === "payment" ? vi.payment.record : vi.promise.record}</h3>
        {entryForm.kind === "payment"
          ? <PaymentForm loanId={loan.id} scheduleEntryId={entryForm.entryId} onSave={savePayment} />
          : <PromiseForm loanId={loan.id} scheduleEntryId={entryForm.entryId} onSave={savePromise} />}
      </section> : null}

      {paymentCorrection ? <section className="schedule-preview" aria-labelledby="payment-correction-heading">
        <h3 id="payment-correction-heading">{paymentCorrection.mode === "edit" ? vi.payment.edit : vi.payment.void}</h3>
        <PaymentCorrectionForm payment={paymentCorrection.payment} mode={paymentCorrection.mode} onSave={savePaymentCorrection} onCancel={() => setPaymentCorrection(undefined)} />
      </section> : null}

      <section className="schedule-preview" aria-labelledby="payments-heading">
        <h3 id="payments-heading">{vi.payment.history}</h3>
        {payments.length === 0 ? <p className="empty-state">{vi.payment.noPayments}</p> : <table>
          <thead><tr><th>{vi.payment.receivedDate}</th><th>{vi.payment.scheduleEntry}</th><th>{vi.loan.principal}</th><th>{vi.loan.interest}</th><th>{vi.common.note}</th><th>{vi.common.actions}</th></tr></thead>
          <tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.receivedAt}</td><td>{payment.scheduleEntryId ?? vi.common.unassigned}</td><td>{formatMoneyVnd(payment.principalAmount)}</td><td>{formatMoneyVnd(payment.interestAmount)}</td><td>{payment.note ?? ""}</td><td>{!isSettled && (payment.status === undefined || payment.status === "active") ? <div className="button-row">
            <Button icon={<Pencil aria-hidden="true" size={16} />} title={vi.payment.edit} onClick={() => setPaymentCorrection({ payment, mode: "edit" })}>{vi.payment.edit}</Button>
            <Button icon={<Trash2 aria-hidden="true" size={16} />} title={vi.payment.void} variant="danger" onClick={() => setPaymentCorrection({ payment, mode: "void" })}>{vi.payment.void}</Button>
          </div> : null}</td></tr>)}</tbody>
        </table>}
      </section>

      <section className="schedule-preview" aria-labelledby="loan-settlement-heading">
        <h3 id="loan-settlement-heading">{vi.loan.settlement}</h3>
        {isSettled ? <>
          <p>{vi.loan.settledDate}: {loan.settledAt ?? vi.common.none}</p>
          <Button icon={<RotateCcw aria-hidden="true" size={16} />} onClick={() => setShowReopenForm((value) => !value)}>{vi.loan.reopen}</Button>
          {showReopenForm ? <form className="lending-form" onSubmit={(event) => { event.preventDefault(); void reopen(); }}>
            <label className="field" htmlFor="loan-reopen-reason"><span>{vi.loan.reopenReason}</span>
              <textarea id="loan-reopen-reason" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
            </label>
            {reopenError ? <p className="form-error" role="alert">{reopenError}</p> : null}
            <Button icon={<RotateCcw aria-hidden="true" size={16} />} variant="primary" type="submit">{vi.loan.confirmReopen}</Button>
          </form> : null}
        </> : <>
          <p>{settlementEligibility.eligible ? vi.loan.eligibleForSettlement : vi.loan.ineligibleForSettlement}</p>
          {!settlementEligibility.eligible ? <p>{vi.loan.remainingBalance}: {formatMoneyVnd(settlementEligibility.outstandingPrincipal + settlementEligibility.outstandingInterest)}</p> : <form className="lending-form" onSubmit={(event) => { event.preventDefault(); void settle(); }}>
            <Field id="loan-settlement-date" label={vi.loan.settlementDate} type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} />
            <Button icon={<Check aria-hidden="true" size={16} />} variant="primary" type="submit">{vi.loan.confirmSettlement}</Button>
          </form>}
        </>}
      </section>

      {paymentHistoryViews.length > 0 ? <section className="schedule-preview" aria-label={vi.payment.adjustmentHistory}>
        {paymentHistoryViews.map(({ payment, adjustments }) => <details key={payment.id}>
          <summary>{vi.payment.adjustmentHistory}</summary>
          {adjustments.map((adjustment) => <section key={adjustment.id}>
            <p>{vi.payment.before}: {adjustment.before.receivedAt} / {formatMoneyVnd(adjustment.before.principalAmount)} / {formatMoneyVnd(adjustment.before.interestAmount)} / <span>{adjustment.before.note ?? ""}</span></p>
            {adjustment.after ? <p>{vi.payment.after}: {adjustment.after.receivedAt} / {formatMoneyVnd(adjustment.after.principalAmount)} / {formatMoneyVnd(adjustment.after.interestAmount)} / <span>{adjustment.after.note ?? ""}</span></p> : null}
            <p>{vi.payment.correctionReason}: <span>{adjustment.reason}</span></p>
            <p>{vi.payment.adjustmentTime}: <span>{adjustment.createdAt}</span></p>
          </section>)}
        </details>)}
      </section> : null}

      <section className="schedule-preview" aria-labelledby="promises-heading">
        <h3 id="promises-heading">{vi.promise.history}</h3>
        {promises.length === 0 ? <p className="empty-state">{vi.promise.noPromises}</p> : <table>
          <thead><tr><th>{vi.promise.promisedDate}</th><th>{vi.payment.scheduleEntry}</th><th>{vi.promise.promise}</th><th>{vi.common.status}</th><th>{vi.common.actions}</th></tr></thead>
          <tbody>{promises.map((promise) => <tr key={promise.id}><td>{promise.promisedDate}</td><td>{promise.scheduleEntryId}</td><td>{promise.note}</td><td>{entryStatusLabel(promise.status)}</td><td>{!isSettled && promise.status === "open" ? <div className="button-row">
            <Button icon={<Check aria-hidden="true" size={16} />} onClick={() => void changePromiseStatus(promise, "fulfilled")}>{vi.promise.fulfil} {promise.id}</Button>
            <Button icon={<X aria-hidden="true" size={16} />} variant="danger" onClick={() => void changePromiseStatus(promise, "cancelled")}>{vi.promise.cancel} {promise.id}</Button>
          </div> : ""}</td></tr>)}</tbody>
        </table>}
      </section>

      <section className="schedule-preview" aria-labelledby="lifecycle-history-heading">
        <h3 id="lifecycle-history-heading">{vi.loan.lifecycleHistory}</h3>
        {lifecycleEvents.length === 0 ? <p className="empty-state">{vi.loan.noLifecycleEvents}</p> : lifecycleEvents.map((event) => <p key={event.id}>{event.action === "settled" ? vi.loan.settled : vi.loan.reopened}: {event.effectiveDate}{event.reason ? ` - ${event.reason}` : ""}</p>)}
      </section>
    </section>
  );
}

import { ArrowLeft, CalendarDays, Check, CircleDollarSign, Pencil, X } from "lucide-react";
import { useState } from "react";
import { calculateEntryStatus, calculateEntryTotals, calculateLoanSummary } from "../domain/ledger";
import type { RevisionInput } from "../domain/revisions";
import type { Loan, PaymentTransaction, PromiseToPay, ScheduleEntry, ScheduleVersion } from "../domain/types";
import { Button } from "../../ui/Button";
import { PaymentForm } from "./PaymentForm";
import { PromiseForm } from "./PromiseForm";
import { ScheduleRevisionForm } from "./ScheduleRevisionForm";
import { formatMoneyVnd } from "./lendingLabels";

export interface LoanDetailProps {
  loan: Loan;
  borrowerName: string;
  versions: ScheduleVersion[];
  entries: ScheduleEntry[];
  payments: PaymentTransaction[];
  promises: PromiseToPay[];
  today: string;
  calendarExportVersionId?: string;
  onBack(): void;
  onSavePayment(value: PaymentTransaction): Promise<void>;
  onSavePromise(value: PromiseToPay): Promise<void>;
  onUpdatePromise(value: PromiseToPay): Promise<void>;
  onSaveRevision(input: RevisionInput): Promise<void>;
  onExportCalendar(versionId: string): void;
}

type EntryForm = { kind: "payment" | "promise"; entryId: string } | undefined;

function entryStatusLabel(value: string): string {
  return value.replaceAll("-", " ");
}

export function LoanDetail({
  loan,
  borrowerName,
  versions,
  entries,
  payments,
  promises,
  today,
  calendarExportVersionId,
  onBack,
  onSavePayment,
  onSavePromise,
  onUpdatePromise,
  onSaveRevision,
  onExportCalendar,
}: LoanDetailProps) {
  const [entryForm, setEntryForm] = useState<EntryForm>();
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const activeVersion = versions.find((version) => version.id === loan.defaultScheduleVersionId);
  const summary = calculateLoanSummary({ loanId: loan.id, entries, payments, promises, today });
  const calendarState = calendarExportVersionId === loan.defaultScheduleVersionId
    ? "Calendar export matches the active schedule."
    : calendarExportVersionId
      ? "Calendar export is stale. Re-export the active schedule."
      : "Calendar has not been exported.";

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

  return (
    <section className="route-panel" aria-labelledby="loan-detail-heading">
      <div className="route-heading">
        <Button icon={<ArrowLeft aria-hidden="true" size={18} />} onClick={onBack}>Borrower</Button>
        <Button icon={<Pencil aria-hidden="true" size={18} />} onClick={() => setShowRevisionForm((value) => !value)}>Revise schedule</Button>
        <Button icon={<CalendarDays aria-hidden="true" size={18} />} variant="primary" onClick={() => onExportCalendar(loan.defaultScheduleVersionId)}>Export Calendar</Button>
      </div>
      <h2 id="loan-detail-heading">Loan details</h2>
      <p>{borrowerName}</p>
      <p>{loan.disbursementDate} to {loan.maturityDate}</p>

      <section className="schedule-preview" aria-labelledby="loan-summary-heading">
        <h3 id="loan-summary-heading">Current balance</h3>
        <p>Outstanding principal: {formatMoneyVnd(summary.outstandingPrincipal)}</p>
        <p>Outstanding interest: {formatMoneyVnd(summary.outstandingInterest)}</p>
        <p>Next due date: {summary.nextDueDate ?? "None"}</p>
        <p>Due today: {summary.dueToday}</p>
        <p>Due soon: {summary.dueSoon}</p>
        <p>Overdue: {summary.overdue}</p>
      </section>

      <section className="schedule-preview" aria-labelledby="calendar-export-heading">
        <h3 id="calendar-export-heading">Calendar export</h3>
        <p>{calendarState}</p>
      </section>

      {showRevisionForm && activeVersion ? <section className="schedule-preview" aria-labelledby="revision-heading">
        <h3 id="revision-heading">New schedule version</h3>
        <ScheduleRevisionForm current={activeVersion} onSave={saveRevision} />
      </section> : null}

      <section className="schedule-preview" aria-labelledby="versions-heading">
        <h3 id="versions-heading">Schedule versions</h3>
        {versions.map((version) => {
          const isActive = version.id === loan.defaultScheduleVersionId;
          const versionEntries = entries.filter((entry) => entry.scheduleVersionId === version.id);
          return <section key={version.id} aria-label={`Schedule version ${version.versionNumber}`}>
            <h4>Version {version.versionNumber} ({isActive ? "active" : "read-only"})</h4>
            <p>Effective: {version.effectiveDate}</p>
            {version.adjustmentReason ? <p>Reason: {version.adjustmentReason}</p> : null}
            <div className="schedule-preview">
              <table>
                <thead><tr><th>Original due</th><th>Status</th><th>Principal expected / received / outstanding</th><th>Interest expected / received / outstanding</th><th>Actions</th></tr></thead>
                <tbody>{versionEntries.map((entry) => {
                  const totals = calculateEntryTotals(entry, payments);
                  const status = calculateEntryStatus({ entry, payments, promises, today });
                  return <tr key={entry.id}>
                    <td>Original due: {entry.dueDate}</td>
                    <td>{entryStatusLabel(status)}</td>
                    <td>{formatMoneyVnd(entry.expectedPrincipal)} / {formatMoneyVnd(totals.receivedPrincipal)} / {formatMoneyVnd(totals.outstandingPrincipal)}</td>
                    <td>{formatMoneyVnd(entry.expectedInterest)} / {formatMoneyVnd(totals.receivedInterest)} / {formatMoneyVnd(totals.outstandingInterest)}</td>
                    <td>{isActive ? <div className="button-row">
                      <Button icon={<CircleDollarSign aria-hidden="true" size={16} />} onClick={() => setEntryForm({ kind: "payment", entryId: entry.id })}>Record payment</Button>
                      <Button icon={<CalendarDays aria-hidden="true" size={16} />} onClick={() => setEntryForm({ kind: "promise", entryId: entry.id })}>Record promise</Button>
                    </div> : "Read-only"}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </section>;
        })}
      </section>

      {entryForm ? <section className="schedule-preview" aria-labelledby="entry-form-heading">
        <h3 id="entry-form-heading">{entryForm.kind === "payment" ? "Record payment" : "Record promise"}</h3>
        {entryForm.kind === "payment"
          ? <PaymentForm loanId={loan.id} scheduleEntryId={entryForm.entryId} onSave={savePayment} />
          : <PromiseForm loanId={loan.id} scheduleEntryId={entryForm.entryId} onSave={savePromise} />}
      </section> : null}

      <section className="schedule-preview" aria-labelledby="payments-heading">
        <h3 id="payments-heading">Payment history</h3>
        {payments.length === 0 ? <p className="empty-state">No payments recorded.</p> : <table>
          <thead><tr><th>Received</th><th>Schedule entry</th><th>Principal</th><th>Interest</th><th>Note</th></tr></thead>
          <tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.receivedAt}</td><td>{payment.scheduleEntryId ?? "Unassigned"}</td><td>{formatMoneyVnd(payment.principalAmount)}</td><td>{formatMoneyVnd(payment.interestAmount)}</td><td>{payment.note ?? ""}</td></tr>)}</tbody>
        </table>}
      </section>

      <section className="schedule-preview" aria-labelledby="promises-heading">
        <h3 id="promises-heading">Promise history</h3>
        {promises.length === 0 ? <p className="empty-state">No promises recorded.</p> : <table>
          <thead><tr><th>Promised date</th><th>Schedule entry</th><th>Promise</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{promises.map((promise) => <tr key={promise.id}><td>{promise.promisedDate}</td><td>{promise.scheduleEntryId}</td><td>{promise.note}</td><td>{promise.status}</td><td>{promise.status === "open" ? <div className="button-row">
            <Button icon={<Check aria-hidden="true" size={16} />} onClick={() => void changePromiseStatus(promise, "fulfilled")}>Fulfil promise {promise.id}</Button>
            <Button icon={<X aria-hidden="true" size={16} />} variant="danger" onClick={() => void changePromiseStatus(promise, "cancelled")}>Cancel promise {promise.id}</Button>
          </div> : ""}</td></tr>)}</tbody>
        </table>}
      </section>
    </section>
  );
}

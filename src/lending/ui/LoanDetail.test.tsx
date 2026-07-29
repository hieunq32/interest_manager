import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Loan, PaymentTransaction, PromiseToPay, ScheduleEntry, ScheduleVersion } from "../domain/types";
import { LoanDetail } from "./LoanDetail";

const loan: Loan = {
  id: "loan-1",
  borrowerId: "borrower-1",
  calculationModel: "equal-principal-flat-interest",
  originalPrincipal: 10_000_000,
  disbursementDate: "2026-06-20",
  monthlyDueDay: 5,
  maturityDate: "2026-12-15",
  rateValue: 0.02,
  rateUnit: "monthly",
  partialPeriodInterestMode: "full-period",
  defaultScheduleVersionId: "version-2",
  status: "active",
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const versions: ScheduleVersion[] = [
  { id: "version-1", loanId: loan.id, versionNumber: 1, effectiveDate: "2026-06-20", calculationModel: loan.calculationModel, principalBase: loan.originalPrincipal, disbursementDate: loan.disbursementDate, monthlyDueDay: 5, maturityDate: loan.maturityDate, rateValue: 0.02, rateUnit: "monthly", partialPeriodInterestMode: "full-period", createdAt: loan.createdAt },
  { id: "version-2", loanId: loan.id, versionNumber: 2, effectiveDate: "2026-09-01", calculationModel: loan.calculationModel, principalBase: loan.originalPrincipal, disbursementDate: loan.disbursementDate, monthlyDueDay: 5, maturityDate: "2027-01-15", rateValue: 0.02, rateUnit: "monthly", partialPeriodInterestMode: "full-period", createdAt: loan.updatedAt },
];

const entries: ScheduleEntry[] = [
  { id: "entry-old", scheduleVersionId: "version-1", periodStart: "2026-07-05", dueDate: "2026-08-05", expectedPrincipal: 1_000_000, expectedInterest: 200_000, status: "upcoming", createdAt: loan.createdAt, updatedAt: loan.createdAt },
  { id: "entry-old-future", scheduleVersionId: "version-1", periodStart: "2026-08-05", dueDate: "2026-09-05", expectedPrincipal: 5_000_000, expectedInterest: 500_000, status: "upcoming", createdAt: loan.createdAt, updatedAt: loan.createdAt },
  { id: "entry-active", scheduleVersionId: "version-2", periodStart: "2026-09-01", dueDate: "2026-10-05", expectedPrincipal: 1_000_000, expectedInterest: 200_000, status: "upcoming", createdAt: loan.updatedAt, updatedAt: loan.updatedAt },
];

const payments: PaymentTransaction[] = [{ id: "payment-1", loanId: loan.id, scheduleEntryId: "entry-old", receivedAt: "2026-08-05", principalAmount: 500_000, interestAmount: 200_000, createdAt: loan.updatedAt }];
const promises: PromiseToPay[] = [{ id: "promise-1", loanId: loan.id, scheduleEntryId: "entry-active", promisedDate: "2026-10-05", note: "Will pay next week", status: "open", createdAt: loan.updatedAt, updatedAt: loan.updatedAt }];

describe("LoanDetail", () => {
  it("shows current-entry balances and immutable version history while exposing daily entry actions", async () => {
    const user = userEvent.setup();
    const onUpdatePromise = vi.fn().mockResolvedValue(undefined);
    const onExportCalendar = vi.fn();
    render(<LoanDetail loan={loan} borrowerName="Nguyen Van A" versions={versions} entries={entries} payments={payments} promises={promises} today="2026-10-06" calendarExportVersionId="version-1" onBack={vi.fn()} onSavePayment={vi.fn().mockResolvedValue(undefined)} onSavePromise={vi.fn().mockResolvedValue(undefined)} onUpdatePromise={onUpdatePromise} onSaveRevision={vi.fn().mockResolvedValue(undefined)} onExportCalendar={onExportCalendar} onSaveReminderOverride={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByText("Outstanding principal: 1,500,000 VND")).toBeInTheDocument();
    expect(screen.getByText("Outstanding interest: 200,000 VND")).toBeInTheDocument();
    expect(screen.getByText("Overdue: 2")).toBeInTheDocument();
    expect(screen.getByText("Calendar export is stale. Re-export the active schedule.")).toBeInTheDocument();
    expect(screen.getByText("Version 1 (read-only)")).toBeInTheDocument();
    expect(screen.getByText("Version 2 (active)")).toBeInTheDocument();
    expect(screen.getByText("2026-06-20 to 2027-01-15")).toBeInTheDocument();
    expect(screen.getByText("Original due: 2026-09-05")).toBeInTheDocument();
    expect(screen.getByText("Original due: 2026-10-05")).toBeInTheDocument();
    expect(screen.getByText("500,000 VND")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fulfil promise promise-1" }));
    expect(onUpdatePromise).toHaveBeenCalledWith(expect.objectContaining({ id: "promise-1", status: "fulfilled" }));
    await user.click(screen.getByRole("button", { name: "Export Calendar" }));
    expect(onExportCalendar).toHaveBeenCalledWith("version-2");
  });

  it("records payments and promises against retained historical entries while superseded future rows stay read-only", async () => {
    const user = userEvent.setup();
    const onSavePayment = vi.fn().mockResolvedValue(undefined);
    const onSavePromise = vi.fn().mockResolvedValue(undefined);
    render(<LoanDetail loan={loan} borrowerName="Nguyen Van A" versions={versions} entries={entries} payments={payments} promises={promises} today="2026-10-06" onBack={vi.fn()} onSavePayment={onSavePayment} onSavePromise={onSavePromise} onUpdatePromise={vi.fn().mockResolvedValue(undefined)} onSaveRevision={vi.fn().mockResolvedValue(undefined)} onExportCalendar={vi.fn()} onSaveReminderOverride={vi.fn().mockResolvedValue(undefined)} />);

    const retainedRow = screen.getByText("Original due: 2026-08-05").closest("tr");
    const supersededFutureRow = screen.getByText("Original due: 2026-09-05").closest("tr");
    expect(retainedRow).not.toBeNull();
    expect(supersededFutureRow).not.toBeNull();
    expect(within(retainedRow!).getByRole("button", { name: "Record payment" })).toBeInTheDocument();
    expect(within(retainedRow!).getByRole("button", { name: "Record promise" })).toBeInTheDocument();
    expect(within(supersededFutureRow!).queryByRole("button")).not.toBeInTheDocument();
    expect(within(supersededFutureRow!).getByText("Read-only")).toBeInTheDocument();

    await user.click(within(retainedRow!).getByRole("button", { name: "Record payment" }));
    await user.type(screen.getByLabelText("Received date"), "2026-10-06");
    await user.type(screen.getByLabelText("Principal received (VND)"), "100000");
    await user.click(screen.getByRole("button", { name: "Save payment" }));
    await waitFor(() => expect(onSavePayment).toHaveBeenCalledWith(expect.objectContaining({
      loanId: loan.id,
      scheduleEntryId: "entry-old",
      principalAmount: 100_000,
    })));

    await user.click(within(retainedRow!).getByRole("button", { name: "Record promise" }));
    await user.type(screen.getByLabelText("Promised date"), "2026-10-20");
    await user.type(screen.getByLabelText("Promise note"), "Historical balance follow-up");
    await user.click(screen.getByRole("button", { name: "Save promise" }));
    await waitFor(() => expect(onSavePromise).toHaveBeenCalledWith(expect.objectContaining({
      loanId: loan.id,
      scheduleEntryId: "entry-old",
      note: "Historical balance follow-up",
    })));
  });

  it("edits and clears the per-loan reminder override", async () => {
    const user = userEvent.setup();
    const onSaveReminderOverride = vi.fn().mockResolvedValue(undefined);
    render(<LoanDetail loan={{ ...loan, reminderOverride: { enabled: true, offsetDays: 1, time: "08:00" } }} borrowerName="Nguyen Van A" versions={versions} entries={entries} payments={payments} promises={promises} today="2026-10-06" onBack={vi.fn()} onSavePayment={vi.fn().mockResolvedValue(undefined)} onSavePromise={vi.fn().mockResolvedValue(undefined)} onUpdatePromise={vi.fn().mockResolvedValue(undefined)} onSaveRevision={vi.fn().mockResolvedValue(undefined)} onExportCalendar={vi.fn()} onSaveReminderOverride={onSaveReminderOverride} />);

    await user.click(screen.getByLabelText("Enable loan reminders"));
    await user.clear(screen.getByLabelText("Loan reminder offset (days)"));
    await user.type(screen.getByLabelText("Loan reminder offset (days)"), "3");
    await user.clear(screen.getByLabelText("Loan reminder time"));
    await user.type(screen.getByLabelText("Loan reminder time"), "09:30");
    await user.click(screen.getByRole("button", { name: "Save loan reminders" }));
    await waitFor(() => expect(onSaveReminderOverride).toHaveBeenCalledWith({
      enabled: false,
      offsetDays: 3,
      time: "09:30",
    }));

    await user.click(screen.getByRole("button", { name: "Clear loan override" }));
    await waitFor(() => expect(onSaveReminderOverride).toHaveBeenLastCalledWith(undefined));
  });
});

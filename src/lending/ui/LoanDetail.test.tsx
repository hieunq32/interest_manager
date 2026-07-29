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

    expect(screen.getByText("Gốc còn phải thu: 1.500.000 đ")).toBeInTheDocument();
    expect(screen.getByText("Lãi còn phải thu: 200.000 đ")).toBeInTheDocument();
    expect(screen.getByText("Quá hạn: 2")).toBeInTheDocument();
    expect(screen.getByText("Lịch Calendar đã cũ. Hãy xuất lại lịch đang áp dụng.")).toBeInTheDocument();
    expect(screen.getByText("Các phiên bản lịch thu 1 (chỉ xem)")).toBeInTheDocument();
    expect(screen.getByText("Các phiên bản lịch thu 2 (đang áp dụng)")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === "2026-06-20 đến 2027-01-15")).toBeInTheDocument();
    expect(screen.getByText("Ngày đến hạn gốc: 2026-09-05")).toBeInTheDocument();
    expect(screen.getByText("Ngày đến hạn gốc: 2026-10-05")).toBeInTheDocument();
    expect(screen.getByText("500.000 đ")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đánh dấu đã thực hiện promise-1" }));
    expect(onUpdatePromise).toHaveBeenCalledWith(expect.objectContaining({ id: "promise-1", status: "fulfilled" }));
    await user.click(screen.getByRole("button", { name: "Xuất lịch Calendar" }));
    expect(onExportCalendar).toHaveBeenCalledWith("version-2");
  });

  it("records payments and promises against retained historical entries while superseded future rows stay read-only", async () => {
    const user = userEvent.setup();
    const onSavePayment = vi.fn().mockResolvedValue(undefined);
    const onSavePromise = vi.fn().mockResolvedValue(undefined);
    render(<LoanDetail loan={loan} borrowerName="Nguyen Van A" versions={versions} entries={entries} payments={payments} promises={promises} today="2026-10-06" onBack={vi.fn()} onSavePayment={onSavePayment} onSavePromise={onSavePromise} onUpdatePromise={vi.fn().mockResolvedValue(undefined)} onSaveRevision={vi.fn().mockResolvedValue(undefined)} onExportCalendar={vi.fn()} onSaveReminderOverride={vi.fn().mockResolvedValue(undefined)} />);

    const retainedRow = screen.getByText("Ngày đến hạn gốc: 2026-08-05").closest("tr");
    const supersededFutureRow = screen.getByText("Ngày đến hạn gốc: 2026-09-05").closest("tr");
    expect(retainedRow).not.toBeNull();
    expect(supersededFutureRow).not.toBeNull();
    expect(within(retainedRow!).getByRole("button", { name: "Ghi nhận khoản thu" })).toBeInTheDocument();
    expect(within(retainedRow!).getByRole("button", { name: "Ghi nhận lời hứa trả" })).toBeInTheDocument();
    expect(within(supersededFutureRow!).queryByRole("button")).not.toBeInTheDocument();
    expect(within(supersededFutureRow!).getByText("chỉ xem")).toBeInTheDocument();

    await user.click(within(retainedRow!).getByRole("button", { name: "Ghi nhận khoản thu" }));
    await user.type(screen.getByLabelText("Ngày thu"), "2026-10-06");
    await user.type(screen.getByLabelText("Gốc đã thu (đ)"), "100000");
    await user.click(screen.getByRole("button", { name: "Lưu khoản thu" }));
    await waitFor(() => expect(onSavePayment).toHaveBeenCalledWith(expect.objectContaining({
      loanId: loan.id,
      scheduleEntryId: "entry-old",
      principalAmount: 100_000,
    })));

    await user.click(within(retainedRow!).getByRole("button", { name: "Ghi nhận lời hứa trả" }));
    await user.type(screen.getByLabelText("Ngày hứa trả"), "2026-10-20");
    await user.type(screen.getByLabelText("Ghi chú hứa trả"), "Historical balance follow-up");
    await user.click(screen.getByRole("button", { name: "Lưu lời hứa trả" }));
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

    await user.click(screen.getByLabelText("Bật nhắc hạn"));
    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.type(screen.getByLabelText("Nhắc trước (ngày)"), "3");
    await user.clear(screen.getByLabelText("Giờ nhắc"));
    await user.type(screen.getByLabelText("Giờ nhắc"), "09:30");
    await user.click(screen.getByRole("button", { name: "Lưu nhắc hạn khoản vay" }));
    await waitFor(() => expect(onSaveReminderOverride).toHaveBeenCalledWith({
      enabled: false,
      offsetDays: 3,
      time: "09:30",
    }));

    await user.click(screen.getByRole("button", { name: "Xóa cấu hình nhắc riêng" }));
    await waitFor(() => expect(onSaveReminderOverride).toHaveBeenLastCalledWith(undefined));
  });
});

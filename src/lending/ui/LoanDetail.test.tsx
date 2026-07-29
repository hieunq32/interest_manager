import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Loan, LoanLifecycleEvent, PaymentAdjustment, PaymentTransaction, PromiseToPay, ScheduleEntry, ScheduleVersion } from "../domain/types";
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

function renderLoanDetail(overrides: Partial<React.ComponentProps<typeof LoanDetail>> = {}) {
  return render(<LoanDetail
    loan={loan}
    borrowerName="Nguyen Van A"
    versions={versions}
    entries={entries}
    payments={payments}
    paymentHistory={payments}
    paymentAdjustments={[]}
    promises={promises}
    today="2026-10-06"
    lifecycleEvents={[]}
    onBack={vi.fn()}
    onSavePayment={vi.fn().mockResolvedValue(undefined)}
    onEditPayment={vi.fn().mockResolvedValue(undefined)}
    onCancelPayment={vi.fn().mockResolvedValue(undefined)}
    onSavePromise={vi.fn().mockResolvedValue(undefined)}
    onUpdatePromise={vi.fn().mockResolvedValue(undefined)}
    onSaveRevision={vi.fn().mockResolvedValue(undefined)}
    onSaveReminderOverride={vi.fn().mockResolvedValue(undefined)}
    onExportCalendar={vi.fn()}
    onSettle={vi.fn().mockResolvedValue(undefined)}
    onReopen={vi.fn().mockResolvedValue(undefined)}
    {...overrides}
  />);
}

describe("LoanDetail", () => {
  it("shows current-entry balances and immutable version history while exposing daily entry actions", async () => {
    const user = userEvent.setup();
    const onUpdatePromise = vi.fn().mockResolvedValue(undefined);
    const onExportCalendar = vi.fn();
    renderLoanDetail({ calendarExportVersionId: "version-1", onUpdatePromise, onExportCalendar });

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
    renderLoanDetail({ onSavePayment, onSavePromise });

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
    renderLoanDetail({ loan: { ...loan, reminderOverride: { enabled: true, offsetDays: 1, time: "08:00" } }, onSaveReminderOverride });

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

  it("opens edit and void correction forms for active payments and expands their audit history", async () => {
    const user = userEvent.setup();
    const onEditPayment = vi.fn().mockResolvedValue(undefined);
    const onCancelPayment = vi.fn().mockResolvedValue(undefined);
    const paymentHistory: PaymentTransaction[] = [
      { ...payments[0], status: "adjusted", updatedAt: "2026-08-06T10:00:00.000Z" },
      { ...payments[0], id: "payment-2", status: "active", receivedAt: "2026-08-06", principalAmount: 700_000, interestAmount: 150_000, updatedAt: "2026-08-06T10:00:00.000Z" },
    ];
    const paymentAdjustments: PaymentAdjustment[] = [{
      id: "adjustment-1", loanId: loan.id, paymentId: payments[0].id, replacementPaymentId: "payment-2", action: "edit",
      reason: "Corrected receipt", before: { scheduleEntryId: "entry-old", receivedAt: "2026-08-05", principalAmount: 500_000, interestAmount: 200_000, note: "Paid in cash" },
      after: { scheduleEntryId: "entry-old", receivedAt: "2026-08-06", principalAmount: 700_000, interestAmount: 150_000, note: "Bank receipt" }, createdAt: "2026-08-06T10:00:00.000Z",
    }];
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderLoanDetail({ payments: [paymentHistory[1]], paymentHistory, paymentAdjustments, onEditPayment, onCancelPayment });

    expect(screen.getByText("2026-08-06")).toBeInTheDocument();
    await user.click(screen.getByText("Lịch sử điều chỉnh"));
    expect(screen.getByText(/Trước điều chỉnh:/)).toBeInTheDocument();
    expect(screen.getByText(/Sau điều chỉnh:/)).toBeInTheDocument();
    expect(screen.getByText("Corrected receipt")).toBeInTheDocument();
    expect(screen.getByText("2026-08-06T10:00:00.000Z")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sửa giao dịch" }));
    await user.type(screen.getByLabelText("Lý do điều chỉnh"), "Fix amount");
    await user.click(screen.getByRole("button", { name: "Lưu điều chỉnh" }));
    await waitFor(() => expect(onEditPayment).toHaveBeenCalledWith(paymentHistory[1], expect.objectContaining({
      receivedAt: "2026-08-06", principalAmount: 700_000, interestAmount: 150_000,
    }), "Fix amount"));

    await user.click(screen.getByRole("button", { name: "Hủy giao dịch" }));
    await user.type(screen.getByLabelText("Lý do điều chỉnh"), "Duplicate");
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy giao dịch" }));
    await waitFor(() => expect(onCancelPayment).toHaveBeenCalledWith(paymentHistory[1], "Duplicate"));
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("hides payment recording and correction actions for settled loans", () => {
    renderLoanDetail({ loan: { ...loan, status: "settled", settledAt: "2026-10-06" } });

    expect(screen.queryAllByRole("button", { name: "Ghi nhận khoản thu" })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Sửa giao dịch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hủy giao dịch" })).not.toBeInTheDocument();
  });

  it("shows remaining balances without a settlement confirmation when the loan is ineligible", () => {
    renderLoanDetail();

    expect(screen.getByText("Chưa đủ điều kiện tất toán")).toBeInTheDocument();
    expect(screen.getByText("Gốc còn phải thu: 1.500.000 đ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xác nhận tất toán" })).not.toBeInTheDocument();
  });

  it("settles an eligible loan using a selected past date", async () => {
    const user = userEvent.setup();
    const onSettle = vi.fn().mockResolvedValue(undefined);
    renderLoanDetail({
      payments: [
        ...payments,
        { id: "payment-old-remainder", loanId: loan.id, scheduleEntryId: "entry-old", receivedAt: "2026-10-06", principalAmount: 500_000, interestAmount: 0, createdAt: loan.updatedAt },
        { id: "payment-active", loanId: loan.id, scheduleEntryId: "entry-active", receivedAt: "2026-10-06", principalAmount: 1_000_000, interestAmount: 200_000, createdAt: loan.updatedAt },
      ],
      onSettle,
    });

    expect(screen.getByText("Đủ điều kiện tất toán")).toBeInTheDocument();
    const settlementDate = screen.getByLabelText("Ngày tất toán");
    expect(settlementDate).toHaveValue("2026-10-06");
    await user.clear(settlementDate);
    await user.type(settlementDate, "2026-09-30");
    await user.click(screen.getByRole("button", { name: "Xác nhận tất toán" }));
    await waitFor(() => expect(onSettle).toHaveBeenCalledWith("2026-09-30"));
  });

  it("shows settlement details, requires a reopening reason, and gates settled mutations", async () => {
    const user = userEvent.setup();
    const onReopen = vi.fn().mockResolvedValue(undefined);
    const lifecycleEvents: LoanLifecycleEvent[] = [{
      id: "lifecycle-settled",
      loanId: loan.id,
      action: "settled",
      effectiveDate: "2026-10-06",
      createdAt: loan.updatedAt,
    }];
    renderLoanDetail({
      loan: { ...loan, status: "settled", settledAt: "2026-10-06" },
      lifecycleEvents,
      onReopen,
    });

    expect(screen.getByText("Ngày tất toán: 2026-10-06")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Điều chỉnh lịch thu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xuất lịch Calendar" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Ghi nhận lời hứa trả" })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Đánh dấu đã thực hiện/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mở lại khoản vay" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận mở lại" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng nhập lý do mở lại khoản vay");
    await user.type(screen.getByLabelText("Lý do mở lại khoản vay"), "Payment correction required");
    await user.click(screen.getByRole("button", { name: "Xác nhận mở lại" }));
    await waitFor(() => expect(onReopen).toHaveBeenCalledWith("Payment correction required"));
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Borrower } from "../domain/types";
import { BorrowerForm } from "./BorrowerForm";
import { LoanForm } from "./LoanForm";

const borrower: Borrower = {
  id: "borrower-1",
  displayName: "Nguyen Van A",
  status: "active",
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z",
};

describe("BorrowerForm", () => {
  it("validates, saves optional details, and archives an existing borrower", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<BorrowerForm onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Lưu người vay" }));
    expect(screen.getByText("Tên hiển thị là bắt buộc")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Tên hiển thị"), " Tran Thi B ");
    await user.type(screen.getByLabelText("Số điện thoại"), "0909000000");
    await user.type(screen.getByLabelText("Ghi chú"), "Prefers afternoon calls");
    await user.click(screen.getByRole("button", { name: "Lưu người vay" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      displayName: "Tran Thi B",
      phone: "0909000000",
      note: "Prefers afternoon calls",
      status: "active",
    });

    rerender(<BorrowerForm value={borrower} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Lưu trữ người vay" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][0]).toMatchObject({
      id: borrower.id,
      displayName: borrower.displayName,
      status: "archived",
      createdAt: borrower.createdAt,
    });
  });
});

describe("LoanForm", () => {
  it("requires a rate before creating a schedule preview", async () => {
    const user = userEvent.setup();
    render(<LoanForm borrowerId="borrower-1" onSave={vi.fn().mockResolvedValue(undefined)} />);

    await user.type(screen.getByLabelText("Tiền gốc (đ)"), "10000000");
    await user.type(screen.getByLabelText("Ngày giải ngân"), "2026-06-20");
    await user.type(screen.getByLabelText("Ngày tất toán"), "2026-12-15");
    await user.click(screen.getByRole("button", { name: "Xem trước lịch thu" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Lãi suất phải là số không âm");
  });

  it("previews six entries before confirming a normalized loan draft", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LoanForm borrowerId="borrower-1" onSave={onSave} />);

    await user.clear(screen.getByLabelText("Tiền gốc (đ)"));
    await user.type(screen.getByLabelText("Tiền gốc (đ)"), "10000000");
    await user.type(screen.getByLabelText("Ngày giải ngân"), "2026-06-20");
    await user.selectOptions(screen.getByLabelText("Mô hình tính"), "equal-principal-flat-interest");
    await user.clear(screen.getByLabelText("Ngày thu hàng tháng"));
    await user.type(screen.getByLabelText("Ngày thu hàng tháng"), "5");
    await user.type(screen.getByLabelText("Ngày tất toán"), "2026-12-15");
    await user.clear(screen.getByLabelText("Lãi suất (%)"));
    await user.type(screen.getByLabelText("Lãi suất (%)"), "2");
    await user.selectOptions(screen.getByLabelText("Đơn vị lãi suất"), "monthly");
    await user.selectOptions(screen.getByLabelText("Cách tính lãi kỳ không trọn tháng"), "calendar-day-prorated");
    await user.click(screen.getByLabelText("Dùng cấu hình nhắc riêng"));
    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.type(screen.getByLabelText("Nhắc trước (ngày)"), "2");
    await user.clear(screen.getByLabelText("Giờ nhắc"));
    await user.type(screen.getByLabelText("Giờ nhắc"), "09:30");
    await user.type(screen.getByLabelText("Ghi chú"), "Six-month term");

    await user.click(screen.getByRole("button", { name: "Xem trước lịch thu" }));

    expect(await screen.findByRole("heading", { name: "Xem trước lịch thu" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(7);
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Xác nhận và lưu khoản vay" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      borrowerId: "borrower-1",
      calculationModel: "equal-principal-flat-interest",
      originalPrincipal: 10_000_000,
      disbursementDate: "2026-06-20",
      monthlyDueDay: 5,
      maturityDate: "2026-12-15",
      rateValue: 0.02,
      rateUnit: "monthly",
      partialPeriodInterestMode: "calendar-day-prorated",
      reminderOverride: { enabled: true, offsetDays: 2, time: "09:30" },
      note: "Six-month term",
    }));
  });

  it("rejects a blank reminder override offset instead of parsing it as zero", async () => {
    const user = userEvent.setup();
    render(<LoanForm borrowerId="borrower-1" onSave={vi.fn().mockResolvedValue(undefined)} />);

    await user.type(screen.getByLabelText("Tiền gốc (đ)"), "10000000");
    await user.type(screen.getByLabelText("Ngày giải ngân"), "2026-06-20");
    await user.type(screen.getByLabelText("Ngày tất toán"), "2026-12-15");
    await user.type(screen.getByLabelText("Lãi suất (%)"), "2");
    await user.click(screen.getByLabelText("Dùng cấu hình nhắc riêng"));
    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.click(screen.getByRole("button", { name: "Xem trước lịch thu" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Số ngày nhắc trước phải là số nguyên không âm");
    expect(screen.queryByRole("heading", { name: "Xem trước lịch thu" })).not.toBeInTheDocument();
  });
});

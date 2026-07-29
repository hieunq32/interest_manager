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

    await user.type(screen.getByLabelText("Principal (VND)"), "10000000");
    await user.type(screen.getByLabelText("Disbursement date"), "2026-06-20");
    await user.type(screen.getByLabelText("Maturity date"), "2026-12-15");
    await user.click(screen.getByRole("button", { name: "Preview schedule" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Rate must be a non-negative number");
  });

  it("previews six entries before confirming a normalized loan draft", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LoanForm borrowerId="borrower-1" onSave={onSave} />);

    await user.clear(screen.getByLabelText("Principal (VND)"));
    await user.type(screen.getByLabelText("Principal (VND)"), "10000000");
    await user.type(screen.getByLabelText("Disbursement date"), "2026-06-20");
    await user.selectOptions(screen.getByLabelText("Calculation model"), "equal-principal-flat-interest");
    await user.clear(screen.getByLabelText("Monthly due day"));
    await user.type(screen.getByLabelText("Monthly due day"), "5");
    await user.type(screen.getByLabelText("Maturity date"), "2026-12-15");
    await user.clear(screen.getByLabelText("Rate (%)"));
    await user.type(screen.getByLabelText("Rate (%)"), "2");
    await user.selectOptions(screen.getByLabelText("Rate unit"), "monthly");
    await user.selectOptions(screen.getByLabelText("Partial-period interest"), "calendar-day-prorated");
    await user.click(screen.getByLabelText("Use reminder override"));
    await user.clear(screen.getByLabelText("Reminder offset (days)"));
    await user.type(screen.getByLabelText("Reminder offset (days)"), "2");
    await user.clear(screen.getByLabelText("Reminder time"));
    await user.type(screen.getByLabelText("Reminder time"), "09:30");
    await user.type(screen.getByLabelText("Note"), "Six-month term");

    await user.click(screen.getByRole("button", { name: "Preview schedule" }));

    expect(await screen.findByRole("heading", { name: "Schedule preview" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(7);
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm and save loan" }));

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

    await user.type(screen.getByLabelText("Principal (VND)"), "10000000");
    await user.type(screen.getByLabelText("Disbursement date"), "2026-06-20");
    await user.type(screen.getByLabelText("Maturity date"), "2026-12-15");
    await user.type(screen.getByLabelText("Rate (%)"), "2");
    await user.click(screen.getByLabelText("Use reminder override"));
    await user.clear(screen.getByLabelText("Reminder offset (days)"));
    await user.click(screen.getByRole("button", { name: "Preview schedule" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Reminder offset must be a non-negative whole number");
    expect(screen.queryByRole("heading", { name: "Schedule preview" })).not.toBeInTheDocument();
  });
});

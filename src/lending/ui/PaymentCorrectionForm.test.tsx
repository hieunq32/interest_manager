import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PaymentTransaction } from "../domain/types";
import { PaymentCorrectionForm } from "./PaymentCorrectionForm";

const payment: PaymentTransaction = {
  id: "payment-1",
  loanId: "loan-1",
  scheduleEntryId: "entry-1",
  receivedAt: "2026-08-05",
  principalAmount: 800_000,
  interestAmount: 200_000,
  note: "Paid in cash",
  createdAt: "2026-08-05T00:00:00.000Z",
};

describe("PaymentCorrectionForm", () => {
  it("edits the payment snapshot and submits a trimmed required reason", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PaymentCorrectionForm payment={payment} mode="edit" onSave={onSave} onCancel={vi.fn()} />);

    expect(screen.getByLabelText("Ngày thu")).toHaveValue("2026-08-05");
    expect(screen.getByLabelText("Gốc đã thu (đ)")).toHaveValue("800000");
    expect(screen.getByLabelText("Lãi đã thu (đ)")).toHaveValue("200000");
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Paid in cash");

    await user.clear(screen.getByLabelText("Ngày thu"));
    await user.type(screen.getByLabelText("Ngày thu"), "2026-08-06");
    await user.clear(screen.getByLabelText("Gốc đã thu (đ)"));
    await user.type(screen.getByLabelText("Gốc đã thu (đ)"), "700000");
    await user.clear(screen.getByLabelText("Lãi đã thu (đ)"));
    await user.type(screen.getByLabelText("Lãi đã thu (đ)"), "150000");
    await user.clear(screen.getByLabelText("Ghi chú"));
    await user.type(screen.getByLabelText("Ghi chú"), " Corrected receipt ");
    await user.click(screen.getByRole("button", { name: "Lưu điều chỉnh" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng nhập lý do điều chỉnh");
    expect(onSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Lý do điều chỉnh"), " Corrected bank receipt ");
    await user.click(screen.getByRole("button", { name: "Lưu điều chỉnh" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      scheduleEntryId: "entry-1",
      receivedAt: "2026-08-06",
      principalAmount: 700_000,
      interestAmount: 150_000,
      note: "Corrected receipt",
    }, "Corrected bank receipt"));
  });

  it("requires a reason to void without exposing editable payment fields", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PaymentCorrectionForm payment={payment} mode="void" onSave={onSave} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText("Ngày thu")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Gốc đã thu (đ)")).not.toBeInTheDocument();
    expect(screen.getByText("2026-08-05")).toBeInTheDocument();
    expect(screen.getByText("800.000 đ")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy giao dịch" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng nhập lý do điều chỉnh");
    expect(onSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Lý do điều chỉnh"), " Duplicate receipt ");
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy giao dịch" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(undefined, "Duplicate receipt"));
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PaymentForm } from "./PaymentForm";

describe("PaymentForm", () => {
  it("requires a positive valid principal or interest amount", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PaymentForm loanId="loan-1" scheduleEntryId="entry-1" onSave={onSave} />);

    await user.type(screen.getByLabelText("Ngày thu"), "2026-08-05");
    await user.click(screen.getByRole("button", { name: "Lưu khoản thu" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Số tiền phải lớn hơn 0");

    await user.type(screen.getByLabelText("Gốc đã thu (đ)"), "1.5");
    await user.click(screen.getByRole("button", { name: "Lưu khoản thu" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Gốc đã thu phải là số nguyên");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("retains separate received amounts, date, and note", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PaymentForm loanId="loan-1" scheduleEntryId="entry-1" onSave={onSave} />);

    await user.type(screen.getByLabelText("Ngày thu"), "2026-08-05");
    await user.type(screen.getByLabelText("Gốc đã thu (đ)"), "800000");
    await user.type(screen.getByLabelText("Lãi đã thu (đ)"), "200000");
    await user.type(screen.getByLabelText("Ghi chú"), " Paid in cash ");
    await user.click(screen.getByRole("button", { name: "Lưu khoản thu" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      loanId: "loan-1",
      scheduleEntryId: "entry-1",
      receivedAt: "2026-08-05",
      principalAmount: 800_000,
      interestAmount: 200_000,
      note: "Paid in cash",
    });
  });
});

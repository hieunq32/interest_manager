import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi as vitest } from "vitest";
import { vi } from "../../i18n/vi";
import { LoanReminderOverrideForm } from "./LoanReminderOverrideForm";

describe("LoanReminderOverrideForm", () => {
  it("keeps Task 3 labels in the Vietnamese catalog", () => {
    expect(vi.loan.previewDueDate).toBe("Ngày đến hạn");
    expect(vi.loan.previewPrincipal).toBe("Gốc");
    expect(vi.loan.previewInterest).toBe("Lãi");
    expect(vi.promise.promisedPrincipal).toBe("Gốc hứa trả (đ)");
    expect(vi.promise.promisedInterest).toBe("Lãi hứa trả (đ)");
    expect(vi.revision.effectiveDate).toBe("Ngày áp dụng");
    expect(vi.revision.adjustmentReason).toBe("Lý do điều chỉnh");
    expect(vi.revision.save).toBe("Lưu phiên bản lịch mới");
  });

  it("renders Vietnamese reminder labels and translates invalid values", async () => {
    const user = userEvent.setup();
    const onSave = vitest.fn().mockResolvedValue(undefined);
    render(<LoanReminderOverrideForm onSave={onSave} />);

    expect(screen.getByLabelText("Dùng cấu hình nhắc riêng")).not.toBeChecked();
    await user.click(screen.getByLabelText("Dùng cấu hình nhắc riêng"));
    expect(screen.getByLabelText("Bật nhắc hạn")).toBeChecked();
    expect(screen.getByLabelText("Nhắc trước (ngày)")).toHaveValue("1");
    expect(screen.getByLabelText("Giờ nhắc")).toHaveValue("08:00");
    expect(screen.getByRole("button", { name: "Lưu nhắc hạn khoản vay" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.type(screen.getByLabelText("Nhắc trước (ngày)"), "-1");
    await user.click(screen.getByRole("button", { name: "Lưu nhắc hạn khoản vay" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Số ngày nhắc trước phải là số nguyên không âm");

    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.type(screen.getByLabelText("Nhắc trước (ngày)"), "2");
    const timeInput = screen.getByLabelText("Giờ nhắc");
    timeInput.setAttribute("type", "text");
    fireEvent.change(timeInput, { target: { value: "25:00" } });
    await user.click(screen.getByRole("button", { name: "Lưu nhắc hạn khoản vay" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Giờ nhắc phải có dạng HH:MM");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a normalized override and clears an existing one", async () => {
    const user = userEvent.setup();
    const onSave = vitest.fn().mockResolvedValue(undefined);
    const { rerender } = render(<LoanReminderOverrideForm onSave={onSave} />);

    await user.click(screen.getByLabelText("Dùng cấu hình nhắc riêng"));
    await user.click(screen.getByLabelText("Bật nhắc hạn"));
    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.type(screen.getByLabelText("Nhắc trước (ngày)"), "3");
    await user.clear(screen.getByLabelText("Giờ nhắc"));
    await user.type(screen.getByLabelText("Giờ nhắc"), "17:45");
    await user.click(screen.getByRole("button", { name: "Lưu nhắc hạn khoản vay" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ enabled: false, offsetDays: 3, time: "17:45" }));

    rerender(<LoanReminderOverrideForm value={{ enabled: true, offsetDays: 1, time: "08:00" }} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Xóa cấu hình nhắc riêng" }));
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith(undefined));
  });
});

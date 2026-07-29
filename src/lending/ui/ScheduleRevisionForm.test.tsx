import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleVersion } from "../domain/types";
import { ScheduleRevisionForm } from "./ScheduleRevisionForm";

const current: ScheduleVersion = {
  id: "version-1",
  loanId: "loan-1",
  versionNumber: 1,
  effectiveDate: "2026-06-20",
  calculationModel: "equal-principal-flat-interest",
  principalBase: 10_000_000,
  disbursementDate: "2026-06-20",
  monthlyDueDay: 5,
  maturityDate: "2026-12-15",
  rateValue: 0.02,
  rateUnit: "monthly",
  partialPeriodInterestMode: "full-period",
  createdAt: "2026-06-20T00:00:00.000Z",
};

describe("ScheduleRevisionForm", () => {
  it("blocks a rate or unit change until a trimmed reason is supplied", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ScheduleRevisionForm current={current} onSave={onSave} />);

    expect(screen.getByLabelText("Lãi suất (%)")).toHaveValue("2");
    await user.clear(screen.getByLabelText("Lãi suất (%)"));
    await user.type(screen.getByLabelText("Lãi suất (%)"), "3");
    await user.click(screen.getByRole("button", { name: "Lưu phiên bản lịch mới" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng nhập lý do điều chỉnh khi thay đổi lãi suất hoặc đơn vị lãi suất");

    await user.type(screen.getByLabelText("Lý do điều chỉnh"), "  New agreement  ");
    await user.click(screen.getByRole("button", { name: "Lưu phiên bản lịch mới" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      previous: current,
      changes: { rateValue: 0.03 },
      adjustmentReason: "New agreement",
    });
  });

  it("allows a maturity-date change without an adjustment reason", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ScheduleRevisionForm current={current} onSave={onSave} />);

    await user.clear(screen.getByLabelText("Ngày tất toán"));
    await user.type(screen.getByLabelText("Ngày tất toán"), "2027-01-15");
    await user.click(screen.getByRole("button", { name: "Lưu phiên bản lịch mới" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      previous: current,
      changes: { maturityDate: "2027-01-15" },
      adjustmentReason: undefined,
    });
  });

  it("rejects blank principal and rate values before numeric parsing", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ScheduleRevisionForm current={current} onSave={onSave} />);

    await user.clear(screen.getByLabelText("Tiền gốc (đ)"));
    await user.click(screen.getByRole("button", { name: "Lưu phiên bản lịch mới" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Tiền gốc cơ sở phải là số nguyên dương");

    await user.type(screen.getByLabelText("Tiền gốc (đ)"), "10000000");
    await user.clear(screen.getByLabelText("Lãi suất (%)"));
    await user.click(screen.getByRole("button", { name: "Lưu phiên bản lịch mới" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Lãi suất phải là số không âm");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("normalizes a two-percent input back to the stored decimal rate", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ScheduleRevisionForm current={{ ...current, rateValue: 0.03 }} onSave={onSave} />);

    await user.clear(screen.getByLabelText("Lãi suất (%)"));
    await user.type(screen.getByLabelText("Lãi suất (%)"), "2");
    await user.type(screen.getByLabelText("Lý do điều chỉnh"), "Agreed reduction");
    await user.click(screen.getByRole("button", { name: "Lưu phiên bản lịch mới" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      changes: { rateValue: 0.02 },
      adjustmentReason: "Agreed reduction",
    });
  });
});

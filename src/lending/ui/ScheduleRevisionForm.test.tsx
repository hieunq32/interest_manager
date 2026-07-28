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

    await user.clear(screen.getByLabelText("Rate (decimal)"));
    await user.type(screen.getByLabelText("Rate (decimal)"), "0.03");
    await user.click(screen.getByRole("button", { name: "Save revision" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/reason/i);

    await user.type(screen.getByLabelText("Adjustment reason"), "  New agreement  ");
    await user.click(screen.getByRole("button", { name: "Save revision" }));
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

    await user.clear(screen.getByLabelText("Maturity date"));
    await user.type(screen.getByLabelText("Maturity date"), "2027-01-15");
    await user.click(screen.getByRole("button", { name: "Save revision" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      previous: current,
      changes: { maturityDate: "2027-01-15" },
      adjustmentReason: undefined,
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { calculateEntryTotals } from "../domain/ledger";
import type { ScheduleEntry } from "../domain/types";
import { PromiseForm } from "./PromiseForm";

const entry: ScheduleEntry = {
  id: "entry-1",
  scheduleVersionId: "version-1",
  periodStart: "2026-07-05",
  dueDate: "2026-08-05",
  expectedPrincipal: 800_000,
  expectedInterest: 200_000,
  status: "due",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("PromiseForm", () => {
  it("requires a promised date and note", async () => {
    const user = userEvent.setup();
    render(<PromiseForm loanId="loan-1" scheduleEntryId="entry-1" onSave={vi.fn().mockResolvedValue(undefined)} />);

    await user.click(screen.getByRole("button", { name: "Lưu lời hứa trả" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng nhập ngày hứa trả");

    await user.type(screen.getByLabelText("Ngày hứa trả"), "2026-08-12");
    await user.click(screen.getByRole("button", { name: "Lưu lời hứa trả" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ghi chú hứa trả là bắt buộc");
  });

  it("stores optional promised amounts without reducing the ledger balance", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const before = calculateEntryTotals(entry, []);
    render(<PromiseForm loanId="loan-1" scheduleEntryId="entry-1" onSave={onSave} />);

    await user.type(screen.getByLabelText("Ngày hứa trả"), "2026-08-12");
    await user.type(screen.getByLabelText("Gốc hứa trả (đ)"), "800000");
    await user.type(screen.getByLabelText("Lãi hứa trả (đ)"), "200000");
    await user.type(screen.getByLabelText("Ghi chú hứa trả"), "Will transfer after lunch");
    await user.click(screen.getByRole("button", { name: "Lưu lời hứa trả" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      loanId: "loan-1",
      scheduleEntryId: "entry-1",
      promisedDate: "2026-08-12",
      promisedPrincipal: 800_000,
      promisedInterest: 200_000,
      note: "Will transfer after lunch",
      status: "open",
    });
    expect(calculateEntryTotals(entry, [])).toEqual(before);
  });
});

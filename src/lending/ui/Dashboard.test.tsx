import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LoanSummary } from "../domain/ledger";
import { Dashboard } from "./Dashboard";

function summary(overrides: Partial<LoanSummary> = {}): LoanSummary {
  return {
    loanId: "loan-1",
    outstandingPrincipal: 1_500_000,
    outstandingInterest: 50_000,
    dueToday: 0,
    dueSoon: 0,
    promised: 0,
    overdue: 0,
    nextDueDate: "2026-08-05",
    ...overrides,
  };
}

describe("Dashboard", () => {
  it("groups due today, upcoming, promised, and overdue loans without a notification queue", async () => {
    const user = userEvent.setup();
    const onOpenLoan = vi.fn();
    render(<Dashboard summaries={[
      summary({ loanId: "due", dueToday: 1 }),
      summary({ loanId: "upcoming", dueSoon: 2 }),
      summary({ loanId: "promised", promised: 1 }),
      summary({ loanId: "overdue", overdue: 3 }),
    ]} onOpenLoan={onOpenLoan} />);

    expect(screen.getByRole("heading", { name: "Đến hạn hôm nay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mở khoản vay due/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sắp đến hạn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mở khoản vay upcoming/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Đã hứa trả" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mở khoản vay promised/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quá hạn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mở khoản vay overdue/ })).toBeInTheDocument();
    expect(screen.queryByText(/notification queue/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mở khoản vay overdue/ }));
    expect(onOpenLoan).toHaveBeenCalledWith("overdue");
  });

  it("shows an empty state for each actionable section", () => {
    render(<Dashboard summaries={[]} onOpenLoan={vi.fn()} />);

    expect(screen.getAllByText("Không có khoản vay trong mục này.")).toHaveLength(4);
    expect(screen.getByText("0 khoản vay đang hoạt động")).toBeInTheDocument();
    expect(screen.getByText("Gốc còn phải thu: 0 đ")).toBeInTheDocument();
  });
});

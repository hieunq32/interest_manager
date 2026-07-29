import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Loan } from "../domain/types";
import { BorrowerDetail, type BorrowerDetailProps } from "./BorrowerDetail";

const borrower = {
  id: "borrower-1",
  displayName: "Nguyễn Văn A",
  status: "active" as const,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

const loans: Loan[] = [
  createLoan("loan-overdue", 1_000_000, "active"),
  createLoan("loan-due", 2_000_000, "active"),
  createLoan("loan-promised", 3_000_000, "active"),
  createLoan("loan-paid", 4_000_000, "settled"),
];

describe("BorrowerDetail", () => {
  it("lọc khoản vay theo trạng thái thu tiền và vẫn giữ tiêu đề người vay", async () => {
    const user = userEvent.setup();
    const props = {
      borrower,
      loans,
      collectionStatuses: {
        "loan-overdue": "overdue",
        "loan-due": "due",
        "loan-promised": "promised",
        "loan-paid": "paid",
      },
      onBack: vi.fn(),
      onEdit: vi.fn(),
      onCreateLoan: vi.fn(),
      onSelectLoan: vi.fn(),
    } as unknown as BorrowerDetailProps;

    render(<BorrowerDetail {...props} />);

    expect(screen.getByRole("heading", { name: "Nguyễn Văn A" })).toBeInTheDocument();
    const loanStatus = screen.getByLabelText("Trạng thái khoản vay");
    const collectionStatus = screen.getByLabelText("Trạng thái thu tiền");
    expect(loanStatus).toHaveValue("all");
    expect(collectionStatus).toHaveValue("all");

    await user.selectOptions(collectionStatus, "overdue");
    expect(screen.getByRole("button", { name: /1\.000\.000/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /2\.000\.000/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /3\.000\.000/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /4\.000\.000/ })).not.toBeInTheDocument();

    await user.selectOptions(loanStatus, "settled");
    expect(screen.getByRole("heading", { name: "Nguyễn Văn A" })).toBeInTheDocument();
  });
});

function createLoan(id: string, originalPrincipal: number, status: Loan["status"]): Loan {
  return {
    id,
    borrowerId: borrower.id,
    calculationModel: "equal-principal-flat-interest",
    originalPrincipal,
    disbursementDate: "2026-07-01",
    monthlyDueDay: 5,
    maturityDate: "2026-12-05",
    rateValue: 0.02,
    rateUnit: "monthly",
    partialPeriodInterestMode: "full-period",
    defaultScheduleVersionId: `version-${id}`,
    status,
    createdAt: borrower.createdAt,
    updatedAt: borrower.updatedAt,
  };
}

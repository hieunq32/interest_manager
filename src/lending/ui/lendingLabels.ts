import { vi } from "../../i18n/vi";
import type { LoanCollectionStatus } from "../domain/loanSelectors";
import type { Borrower, CalculationModel, LoanStatus, MoneyVnd, PartialPeriodInterestMode, RateUnit } from "../domain/types";

export const calculationModelLabels: Record<CalculationModel, string> = {
  "interest-only-final-principal": "Chỉ thu lãi, thu gốc khi tất toán",
  "equal-principal-flat-interest": "Gốc đều, lãi phẳng",
};

export const rateUnitLabels: Record<RateUnit, string> = {
  monthly: "Theo tháng",
  daily: "Theo ngày",
};

export const partialPeriodInterestModeLabels: Record<PartialPeriodInterestMode, string> = {
  "full-period": "Đủ kỳ",
  "calendar-day-prorated": "Tính theo ngày thực tế",
};

export const borrowerStatusLabels: Record<Borrower["status"], string> = {
  active: vi.status.active,
  archived: vi.status.archived,
};

export const loanStatusLabels: Record<LoanStatus, string> = {
  draft: vi.status.draft,
  active: vi.status.active,
  settled: vi.status.settled,
  archived: vi.status.archived,
};

export const collectionStatusLabels: Record<LoanCollectionStatus, string> = {
  upcoming: vi.status.upcoming,
  due: vi.status.due,
  promised: vi.status.promised,
  overdue: vi.status.overdue,
  paid: vi.status.paid,
};

export function formatMoneyVnd(value: MoneyVnd): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

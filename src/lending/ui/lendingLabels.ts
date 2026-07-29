import type { CalculationModel, MoneyVnd, PartialPeriodInterestMode, RateUnit } from "../domain/types";

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

export function formatMoneyVnd(value: MoneyVnd): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

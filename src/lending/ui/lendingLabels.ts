import type { CalculationModel, MoneyVnd, PartialPeriodInterestMode, RateUnit } from "../domain/types";

export const calculationModelLabels: Record<CalculationModel, string> = {
  "interest-only-final-principal": "Interest only, principal at maturity",
  "equal-principal-flat-interest": "Equal principal, flat interest",
};

export const rateUnitLabels: Record<RateUnit, string> = {
  monthly: "Monthly",
  daily: "Daily",
};

export const partialPeriodInterestModeLabels: Record<PartialPeriodInterestMode, string> = {
  "full-period": "Full period",
  "calendar-day-prorated": "Prorated by calendar day",
};

export function formatMoneyVnd(value: MoneyVnd): string {
  return `${new Intl.NumberFormat("en-US").format(value)} VND`;
}

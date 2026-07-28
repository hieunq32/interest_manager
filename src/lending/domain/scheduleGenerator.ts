import { compareDateOnly, nextDueDateAfter } from "./dateRules";
import { calculatePeriodInterest } from "./interest";
import { assertValidMoney } from "./money";
import type { DateOnly, MoneyVnd, ScheduleEntry, ScheduleVersion } from "./types";

function isInMaturityMonth(date: DateOnly, maturityDate: DateOnly): boolean {
  return date.slice(0, 7) === maturityDate.slice(0, 7);
}

function assertScheduleBounds(version: ScheduleVersion): void {
  if (compareDateOnly(version.maturityDate, version.disbursementDate) <= 0) {
    throw new Error("maturityDate must be after disbursementDate");
  }
  if (compareDateOnly(version.effectiveDate, version.maturityDate) >= 0) {
    throw new Error("effectiveDate must be before maturityDate");
  }
}

export function buildScheduleDates(version: ScheduleVersion): DateOnly[] {
  assertScheduleBounds(version);

  const dates: DateOnly[] = [];
  let dueDate = nextDueDateAfter(version.effectiveDate, version.monthlyDueDay);
  while (compareDateOnly(dueDate, version.maturityDate) < 0) {
    if (
      version.calculationModel === "interest-only-final-principal" ||
      !isInMaturityMonth(dueDate, version.maturityDate)
    ) {
      dates.push(dueDate);
    }
    dueDate = nextDueDateAfter(dueDate, version.monthlyDueDay);
  }

  dates.push(version.maturityDate);
  return dates;
}

function equalPrincipalAllocation(principalBase: MoneyVnd, entryCount: number, entryIndex: number): MoneyVnd {
  const regularPrincipal = Math.floor(principalBase / entryCount);
  if (entryIndex < entryCount - 1) {
    return regularPrincipal;
  }
  return principalBase - regularPrincipal * (entryCount - 1);
}

export function generateSchedule(version: ScheduleVersion): ScheduleEntry[] {
  assertValidMoney(version.principalBase, "principalBase");
  const dueDates = buildScheduleDates(version);

  return dueDates.map((dueDate, index) => {
    const isFinalPeriod = index === dueDates.length - 1;
    const periodStart = index === 0 ? version.effectiveDate : dueDates[index - 1];
    const expectedPrincipal =
      version.calculationModel === "equal-principal-flat-interest"
        ? equalPrincipalAllocation(version.principalBase, dueDates.length, index)
        : isFinalPeriod
          ? version.principalBase
          : 0;

    return {
      id: `${version.id}:${dueDate}`,
      scheduleVersionId: version.id,
      periodStart,
      dueDate,
      expectedPrincipal,
      expectedInterest: calculatePeriodInterest({
        principalBase: version.principalBase,
        rateValue: version.rateValue,
        rateUnit: version.rateUnit,
        periodStart,
        periodEnd: dueDate,
        isFirstPeriod: index === 0,
        isFinalPeriod,
        partialPeriodInterestMode: version.partialPeriodInterestMode,
      }),
      status: "upcoming",
      createdAt: version.createdAt,
      updatedAt: version.createdAt,
    };
  });
}

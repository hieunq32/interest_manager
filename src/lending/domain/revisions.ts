import { generateSchedule } from "./scheduleGenerator";
import type { DateOnly, ScheduleEntry, ScheduleVersion } from "./types";

type RevisionChanges = Partial<
  Pick<
    ScheduleVersion,
    | "calculationModel"
    | "principalBase"
    | "disbursementDate"
    | "monthlyDueDay"
    | "maturityDate"
    | "rateValue"
    | "rateUnit"
    | "partialPeriodInterestMode"
  >
>;

export interface RevisionInput {
  previous: ScheduleVersion;
  effectiveDate: DateOnly;
  changes: RevisionChanges;
  adjustmentReason?: string;
  createdAt: string;
}

function revisionId(previous: ScheduleVersion): string {
  return `${previous.id}:v${previous.versionNumber + 1}`;
}

export function validateRevisionReason(input: {
  previous: ScheduleVersion;
  next: ScheduleVersion;
  adjustmentReason?: string;
}): void {
  const rateChanged = input.previous.rateValue !== input.next.rateValue || input.previous.rateUnit !== input.next.rateUnit;
  if (rateChanged && !input.adjustmentReason?.trim()) {
    throw new Error("A non-empty adjustment reason is required when changing the rate or rate unit");
  }
}

export function createScheduleRevision(input: RevisionInput): {
  version: ScheduleVersion;
  entries: ScheduleEntry[];
  activeScheduleVersionId: string;
} {
  const adjustmentReason = input.adjustmentReason?.trim() || undefined;
  const version: ScheduleVersion = {
    ...input.previous,
    ...input.changes,
    id: revisionId(input.previous),
    versionNumber: input.previous.versionNumber + 1,
    effectiveDate: input.effectiveDate,
    adjustmentReason,
    createdAt: input.createdAt,
  };
  validateRevisionReason({ previous: input.previous, next: version, adjustmentReason });

  return { version, entries: generateSchedule(version), activeScheduleVersionId: version.id };
}

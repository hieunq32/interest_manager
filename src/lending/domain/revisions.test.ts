import { describe, expect, it } from "vitest";
import { createScheduleRevision, validateRevisionReason } from "./revisions";
import type { ScheduleVersion } from "./types";

function version(overrides: Partial<ScheduleVersion> = {}): ScheduleVersion {
  return {
    id: "schedule-v1",
    loanId: "loan-1",
    versionNumber: 1,
    effectiveDate: "2026-06-20",
    calculationModel: "equal-principal-flat-interest",
    principalBase: 12_000,
    disbursementDate: "2026-06-20",
    monthlyDueDay: 5,
    maturityDate: "2026-12-15",
    rateValue: 0.02,
    rateUnit: "monthly",
    partialPeriodInterestMode: "calendar-day-prorated",
    createdAt: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("schedule revisions", () => {
  it("rejects a rate or rate-unit change without a trimmed adjustment reason", () => {
    expect(() =>
      validateRevisionReason({ previous: version(), next: version({ rateValue: 0.03 }), adjustmentReason: "   " }),
    ).toThrow(/reason/i);
    expect(() =>
      validateRevisionReason({ previous: version(), next: version({ rateUnit: "daily" }) }),
    ).toThrow(/reason/i);
  });

  it("creates an immutable future revision for a maturity change without requiring a reason", () => {
    const previous = version();
    const result = createScheduleRevision({
      previous,
      effectiveDate: "2026-09-12",
      changes: { maturityDate: "2027-01-15" },
      createdAt: "2026-09-12T00:00:00.000Z",
    });

    expect(result.version).toMatchObject({
      loanId: "loan-1",
      versionNumber: 2,
      effectiveDate: "2026-09-12",
      maturityDate: "2027-01-15",
      adjustmentReason: undefined,
      createdAt: "2026-09-12T00:00:00.000Z",
    });
    expect(result.version.id).not.toBe(previous.id);
    expect(previous).toEqual(version());
    expect(result.entries.map((item) => [item.scheduleVersionId, item.periodStart, item.dueDate])).toEqual([
      [result.version.id, "2026-09-12", "2026-10-05"],
      [result.version.id, "2026-10-05", "2026-11-05"],
      [result.version.id, "2026-11-05", "2026-12-05"],
      [result.version.id, "2026-12-05", "2027-01-15"],
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { buildScheduleDates, generateSchedule } from "./scheduleGenerator";
import type { ScheduleVersion } from "./types";

function version(overrides: Partial<ScheduleVersion> = {}): ScheduleVersion {
  return {
    id: "schedule-v1",
    loanId: "loan-1",
    versionNumber: 1,
    effectiveDate: "2026-06-20",
    calculationModel: "equal-principal-flat-interest",
    principalBase: 10_000_001,
    disbursementDate: "2026-06-20",
    monthlyDueDay: 5,
    maturityDate: "2026-12-15",
    rateValue: 0.02,
    rateUnit: "monthly",
    partialPeriodInterestMode: "calendar-day-prorated",
    createdAt: "2026-06-20",
    ...overrides,
  };
}

describe("schedule generation", () => {
  it("uses the exact maturity date instead of a regular equal-principal maturity-month date", () => {
    expect(buildScheduleDates(version())).toEqual([
      "2026-07-05",
      "2026-08-05",
      "2026-09-05",
      "2026-10-05",
      "2026-11-05",
      "2026-12-15",
    ]);
  });

  it("allocates equal principal with its remainder in the final entry", () => {
    const entries = generateSchedule(version());

    expect(entries.map((entry) => entry.expectedPrincipal)).toEqual([
      1_666_666,
      1_666_666,
      1_666_666,
      1_666_666,
      1_666_666,
      1_666_671,
    ]);
    expect(entries.reduce((total, entry) => total + entry.expectedPrincipal, 0)).toBe(10_000_001);
    expect(entries.map((entry) => entry.id)).toEqual([
      "schedule-v1:2026-07-05",
      "schedule-v1:2026-08-05",
      "schedule-v1:2026-09-05",
      "schedule-v1:2026-10-05",
      "schedule-v1:2026-11-05",
      "schedule-v1:2026-12-15",
    ]);
    expect(entries.every((entry) => entry.status === "upcoming")).toBe(true);
  });

  it("keeps interest-only principal at zero until the maturity entry", () => {
    const entries = generateSchedule(version({ calculationModel: "interest-only-final-principal" }));

    expect(entries.map((entry) => entry.dueDate)).toEqual([
      "2026-07-05",
      "2026-08-05",
      "2026-09-05",
      "2026-10-05",
      "2026-11-05",
      "2026-12-05",
      "2026-12-15",
    ]);
    expect(entries.map((entry) => entry.expectedPrincipal)).toEqual([0, 0, 0, 0, 0, 0, 10_000_001]);
    expect(entries.at(-1)).toMatchObject({
      periodStart: "2026-12-05",
      dueDate: "2026-12-15",
      expectedInterest: 64_516,
    });
  });

  it.each([
    ["2026-01-15", "2026-05-15", ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-15"]],
    ["2024-01-15", "2024-03-15", ["2024-01-31", "2024-02-29", "2024-03-15"]],
  ] as const)("resolves a day-31 due date through short months", (disbursementDate, maturityDate, expectedDates) => {
    expect(
      buildScheduleDates(
        version({
          disbursementDate,
          effectiveDate: disbursementDate,
          monthlyDueDay: 31,
          maturityDate,
        }),
      ),
    ).toEqual(expectedDates);
  });

  it("uses a revised version's effective date as the first period boundary", () => {
    const entries = generateSchedule(
      version({
        id: "schedule-v2",
        versionNumber: 2,
        effectiveDate: "2026-09-12",
      }),
    );

    expect(entries.map((entry) => [entry.periodStart, entry.dueDate])).toEqual([
      ["2026-09-12", "2026-10-05"],
      ["2026-10-05", "2026-11-05"],
      ["2026-11-05", "2026-12-15"],
    ]);
  });

  it("rejects an effective date before disbursement", () => {
    expect(() =>
      buildScheduleDates(version({ effectiveDate: "2026-06-19" })),
    ).toThrow(/effectiveDate.*disbursementDate/i);
  });
});

import { describe, expect, it } from "vitest";
import { calculateMonthlyProratedInterest, calculatePeriodInterest } from "./interest";

describe("lending interest calculations", () => {
  it("charges one full month for a first monthly period", () => {
    expect(
      calculatePeriodInterest({
        principalBase: 10_000_000,
        rateValue: 0.02,
        rateUnit: "monthly",
        periodStart: "2026-06-20",
        periodEnd: "2026-07-05",
        isFirstPeriod: true,
        isFinalPeriod: false,
        partialPeriodInterestMode: "calendar-day-prorated",
      }),
    ).toBe(200_000);
  });

  it("prorates a final monthly period by actual days in its calendar month", () => {
    expect(
      calculatePeriodInterest({
        principalBase: 10_000_000,
        rateValue: 0.02,
        rateUnit: "monthly",
        periodStart: "2026-04-05",
        periodEnd: "2026-04-15",
        isFirstPeriod: false,
        isFinalPeriod: true,
        partialPeriodInterestMode: "calendar-day-prorated",
      }),
    ).toBe(66_667);
  });

  it("sums unrounded calendar-month segments before the final rounding", () => {
    expect(calculateMonthlyProratedInterest(10_000_000, 0.02, "2026-04-20", "2026-05-05")).toBe(99_140);
  });

  it("calculates daily interest from actual calendar days", () => {
    expect(
      calculatePeriodInterest({
        principalBase: 10_000_000,
        rateValue: 0.001,
        rateUnit: "daily",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-16",
        isFirstPeriod: false,
        isFinalPeriod: true,
        partialPeriodInterestMode: "full-period",
      }),
    ).toBe(150_000);
  });

  it.each(["monthly", "daily"] as const)("rejects a negative %s rate", (rateUnit) => {
    expect(() =>
      calculatePeriodInterest({
        principalBase: 10_000_000,
        rateValue: -0.01,
        rateUnit,
        periodStart: "2026-06-01",
        periodEnd: "2026-06-16",
        isFirstPeriod: false,
        isFinalPeriod: true,
        partialPeriodInterestMode: "full-period",
      }),
    ).toThrow(/rateValue/);
  });

  it.each([NaN, Infinity, -Infinity])("rejects non-finite rates: %s", (rateValue) => {
    expect(() =>
      calculatePeriodInterest({
        principalBase: 10_000_000,
        rateValue,
        rateUnit: "monthly",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-16",
        isFirstPeriod: false,
        isFinalPeriod: false,
        partialPeriodInterestMode: "full-period",
      }),
    ).toThrow(/rateValue/);
  });

  it("rejects an invalid period boundary", () => {
    expect(() => calculateMonthlyProratedInterest(10_000_000, 0.02, "2026-06-16", "2026-06-01")).toThrow(
      /before/,
    );
    expect(() => calculateMonthlyProratedInterest(10_000_000, 0.02, "2026-06-01", "2026-06-01")).toThrow(
      /calendar day|before/,
    );
  });
});

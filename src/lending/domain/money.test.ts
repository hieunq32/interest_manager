import { describe, expect, it } from "vitest";
import { assertValidMoney, roundMoney } from "./money";

describe("money helpers", () => {
  it("rounds fractional VND to an integer", () => {
    expect(roundMoney(123.4)).toBe(123);
    expect(roundMoney(123.5)).toBe(124);
  });

  it("accepts zero and safe non-negative integer VND", () => {
    expect(assertValidMoney(0)).toBe(0);
    expect(assertValidMoney(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([NaN, Infinity, -Infinity])("rejects non-finite money: %s", (value) => {
    expect(() => assertValidMoney(value)).toThrow(/must be a finite number/);
  });

  it("rejects negative money", () => {
    expect(() => assertValidMoney(-1)).toThrow(/must be non-negative/);
  });

  it("rejects fractional values at the persistence boundary", () => {
    expect(() => assertValidMoney(1.5)).toThrow(/must be an integer/);
  });

  it("rejects values outside the safe integer range", () => {
    expect(() => assertValidMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/);
  });

  it("uses the field name in validation errors", () => {
    expect(() => assertValidMoney(Infinity, "rateValue")).toThrow(/rateValue/);
  });

  it("rejects values that round outside the safe integer range", () => {
    expect(() => roundMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/);
  });
});

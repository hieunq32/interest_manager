import { describe, expect, it } from "vitest";
import { parseHashRoute, serializeHashRoute } from "./routes";

describe("hash routes", () => {
  it.each([
    ["", { name: "dashboard" }],
    ["#/", { name: "dashboard" }],
    ["#/borrowers/borrower-1", { name: "borrower", borrowerId: "borrower-1" }],
    ["#/loans/loan-1", { name: "loan", loanId: "loan-1" }],
    ["#/settings", { name: "settings" }],
    ["#/not-a-route", { name: "dashboard" }],
  ] as const)("parses %s", (hash, expected) => {
    expect(parseHashRoute(hash)).toEqual(expected);
  });

  it("round trips encoded record ids", () => {
    const route = { name: "borrower" as const, borrowerId: "a/b #1" };

    expect(serializeHashRoute(route)).toBe("#/borrowers/a%2Fb%20%231");
    expect(parseHashRoute(serializeHashRoute(route))).toEqual(route);
  });
});

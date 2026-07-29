import { describe, expect, it } from "vitest";
import {
  buildPaymentCancellation,
  buildPaymentCorrection,
  normalizePayment,
} from "./paymentCorrections";
import type { PaymentSnapshot, PaymentTransaction } from "./types";

const legacyPayment: PaymentTransaction = {
  id: "payment-1",
  loanId: "loan-1",
  scheduleEntryId: "entry-1",
  receivedAt: "2026-07-10",
  principalAmount: 1_000,
  interestAmount: 100,
  note: "Initial payment",
  createdAt: "2026-07-10T09:00:00.000Z",
};

const nextPayment: PaymentSnapshot = {
  scheduleEntryId: "entry-1",
  receivedAt: "2026-07-11",
  principalAmount: 900,
  interestAmount: 125,
  note: "Corrected payment",
};

const now = "2026-07-12T10:00:00.000Z";

describe("payment corrections", () => {
  it("treats a legacy payment without status as active", () => {
    expect(normalizePayment(legacyPayment)).toMatchObject({
      status: "active",
      updatedAt: legacyPayment.createdAt,
    });
  });

  it("creates an auditable replacement for an active payment edit", () => {
    expect(
      buildPaymentCorrection({
        payment: legacyPayment,
        next: nextPayment,
        reason: "Corrected receipt",
        adjustmentId: "adjustment-1",
        replacementId: "payment-2",
        now,
      }),
    ).toEqual({
      original: {
        ...legacyPayment,
        status: "adjusted",
        updatedAt: now,
      },
      replacement: {
        id: "payment-2",
        loanId: legacyPayment.loanId,
        ...nextPayment,
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      adjustment: {
        id: "adjustment-1",
        loanId: legacyPayment.loanId,
        paymentId: legacyPayment.id,
        replacementPaymentId: "payment-2",
        action: "edit",
        reason: "Corrected receipt",
        before: {
          scheduleEntryId: legacyPayment.scheduleEntryId,
          receivedAt: legacyPayment.receivedAt,
          principalAmount: legacyPayment.principalAmount,
          interestAmount: legacyPayment.interestAmount,
          note: legacyPayment.note,
        },
        after: nextPayment,
        createdAt: now,
      },
    });
  });

  it("creates an auditable cancellation without a replacement payment", () => {
    expect(
      buildPaymentCancellation({
        payment: legacyPayment,
        reason: "Duplicate receipt",
        adjustmentId: "adjustment-1",
        now,
      }),
    ).toEqual({
      original: {
        ...legacyPayment,
        status: "voided",
        updatedAt: now,
      },
      adjustment: {
        id: "adjustment-1",
        loanId: legacyPayment.loanId,
        paymentId: legacyPayment.id,
        action: "void",
        reason: "Duplicate receipt",
        before: {
          scheduleEntryId: legacyPayment.scheduleEntryId,
          receivedAt: legacyPayment.receivedAt,
          principalAmount: legacyPayment.principalAmount,
          interestAmount: legacyPayment.interestAmount,
          note: legacyPayment.note,
        },
        createdAt: now,
      },
    });
  });

  it("rejects payment corrections without a reason", () => {
    expect(() =>
      buildPaymentCorrection({
        payment: legacyPayment,
        next: nextPayment,
        reason: "   ",
        adjustmentId: "adjustment-1",
        replacementId: "payment-2",
        now,
      }),
    ).toThrow(/reason/i);
  });

  it("rejects payment corrections that change the linked schedule entry", () => {
    expect(() =>
      buildPaymentCorrection({
        payment: legacyPayment,
        next: { ...nextPayment, scheduleEntryId: "entry-2" },
        reason: "Corrected receipt",
        adjustmentId: "adjustment-1",
        replacementId: "payment-2",
        now,
      }),
    ).toThrow(/schedule entry/i);
  });

  it("rejects payment corrections with negative or fractional VND amounts", () => {
    const input = {
      payment: legacyPayment,
      reason: "Corrected receipt",
      adjustmentId: "adjustment-1",
      replacementId: "payment-2",
      now,
    };

    expect(() => buildPaymentCorrection({ ...input, next: { ...nextPayment, principalAmount: -1 } })).toThrow(/principal/i);
    expect(() => buildPaymentCorrection({ ...input, next: { ...nextPayment, interestAmount: 1.5 } })).toThrow(/interest/i);
  });

  it("rejects a correction with no positive received component", () => {
    expect(() =>
      buildPaymentCorrection({
        payment: legacyPayment,
        next: { ...nextPayment, principalAmount: 0, interestAmount: 0 },
        reason: "Corrected receipt",
        adjustmentId: "adjustment-1",
        replacementId: "payment-2",
        now,
      }),
    ).toThrow("At least one received amount must be positive");
  });

  it.each([
    ["a blank received date", ""],
    ["a malformed received date", "2026-02-30"],
  ])("rejects %s", (_description, receivedAt) => {
    expect(() =>
      buildPaymentCorrection({
        payment: legacyPayment,
        next: { ...nextPayment, receivedAt },
        reason: "Corrected receipt",
        adjustmentId: "adjustment-1",
        replacementId: "payment-2",
        now,
      }),
    ).toThrow("receivedAt must be a valid DateOnly");
  });

  it("rejects corrections and cancellations for a payment that is not active", () => {
    const adjustedPayment = { ...legacyPayment, status: "adjusted" as const };

    expect(() =>
      buildPaymentCorrection({
        payment: adjustedPayment,
        next: nextPayment,
        reason: "Corrected receipt",
        adjustmentId: "adjustment-1",
        replacementId: "payment-2",
        now,
      }),
    ).toThrow(/active/i);
    expect(() =>
      buildPaymentCancellation({
        payment: adjustedPayment,
        reason: "Duplicate receipt",
        adjustmentId: "adjustment-1",
        now,
      }),
    ).toThrow(/active/i);
  });
});

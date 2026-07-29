import { assertValidMoney } from "./money";
import type {
  PaymentAdjustment,
  PaymentCancellationMutation,
  PaymentCorrectionMutation,
  PaymentSnapshot,
  PaymentTransaction,
} from "./types";

function snapshotPayment(payment: PaymentTransaction): PaymentSnapshot {
  return {
    scheduleEntryId: payment.scheduleEntryId,
    receivedAt: payment.receivedAt,
    principalAmount: payment.principalAmount,
    interestAmount: payment.interestAmount,
    note: payment.note,
  };
}

function assertReason(reason: string): void {
  if (reason.trim() === "") {
    throw new Error("reason is required");
  }
}

function assertActivePayment(payment: PaymentTransaction): PaymentTransaction {
  const normalized = normalizePayment(payment);
  if (normalized.status !== "active") {
    throw new Error("payment must be active");
  }
  return normalized;
}

function assertValidSnapshot(snapshot: PaymentSnapshot): void {
  assertValidMoney(snapshot.principalAmount, "principalAmount");
  assertValidMoney(snapshot.interestAmount, "interestAmount");
}

export function normalizePayment(value: PaymentTransaction): PaymentTransaction {
  return {
    ...value,
    status: value.status ?? "active",
    updatedAt: value.updatedAt ?? value.createdAt,
  };
}

export function buildPaymentCorrection(input: {
  payment: PaymentTransaction;
  next: PaymentSnapshot;
  reason: string;
  adjustmentId: string;
  replacementId: string;
  now: string;
}): PaymentCorrectionMutation {
  const payment = assertActivePayment(input.payment);
  assertReason(input.reason);
  if (input.next.scheduleEntryId !== payment.scheduleEntryId) {
    throw new Error("schedule entry cannot be changed");
  }
  assertValidSnapshot(input.next);

  const original = { ...payment, status: "adjusted" as const, updatedAt: input.now };
  const replacement: PaymentTransaction = {
    id: input.replacementId,
    loanId: payment.loanId,
    ...input.next,
    status: "active",
    createdAt: input.now,
    updatedAt: input.now,
  };
  const adjustment: PaymentAdjustment = {
    id: input.adjustmentId,
    loanId: payment.loanId,
    paymentId: payment.id,
    replacementPaymentId: input.replacementId,
    action: "edit",
    reason: input.reason,
    before: snapshotPayment(payment),
    after: { ...input.next },
    createdAt: input.now,
  };

  return { original, replacement, adjustment };
}

export function buildPaymentCancellation(input: {
  payment: PaymentTransaction;
  reason: string;
  adjustmentId: string;
  now: string;
}): PaymentCancellationMutation {
  const payment = assertActivePayment(input.payment);
  assertReason(input.reason);

  const original = { ...payment, status: "voided" as const, updatedAt: input.now };
  const adjustment: PaymentAdjustment = {
    id: input.adjustmentId,
    loanId: payment.loanId,
    paymentId: payment.id,
    action: "void",
    reason: input.reason,
    before: snapshotPayment(payment),
    createdAt: input.now,
  };

  return { original, adjustment };
}

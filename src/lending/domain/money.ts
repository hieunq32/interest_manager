import type { MoneyVnd } from "./types";

export function assertValidMoney(value: number, fieldName = "money"): MoneyVnd {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  if (value < 0) {
    throw new Error(`${fieldName} must be non-negative`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${fieldName} must be a safe integer`);
  }
  return value;
}

export function roundMoney(value: number): MoneyVnd {
  if (!Number.isFinite(value)) {
    throw new Error("money must be a finite number");
  }
  if (value < 0) {
    throw new Error("money must be non-negative");
  }
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded)) {
    throw new Error("money must round to a safe integer");
  }
  return rounded;
}

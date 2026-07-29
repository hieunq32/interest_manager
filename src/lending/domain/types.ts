export type DateOnly = string;
export type MoneyVnd = number;

export type CalculationModel =
  | "interest-only-final-principal"
  | "equal-principal-flat-interest";
export type RateUnit = "monthly" | "daily";
export type PartialPeriodInterestMode = "full-period" | "calendar-day-prorated";
export type LoanStatus = "draft" | "active" | "settled" | "archived";
export type EntryStatus = "upcoming" | "due" | "promised" | "partially-paid" | "overdue" | "paid";
export type PromiseStatus = "open" | "fulfilled" | "cancelled" | "expired";
export type PaymentStatus = "active" | "adjusted" | "voided";

export interface ReminderOverride {
  enabled?: boolean;
  offsetDays?: number;
  time?: string;
}

export interface ReminderSettings {
  enabled: boolean;
  offsetDays: number;
  time: string;
}

export interface Borrower {
  id: string;
  displayName: string;
  phone?: string;
  note?: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  borrowerId: string;
  calculationModel: CalculationModel;
  originalPrincipal: MoneyVnd;
  disbursementDate: DateOnly;
  monthlyDueDay: number;
  maturityDate: DateOnly;
  rateValue: number;
  rateUnit: RateUnit;
  partialPeriodInterestMode: PartialPeriodInterestMode;
  defaultScheduleVersionId: string;
  calendarExportVersionId?: string;
  settledAt?: DateOnly;
  reminderOverride?: ReminderOverride;
  status: LoanStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleVersion {
  id: string;
  loanId: string;
  versionNumber: number;
  effectiveDate: DateOnly;
  calculationModel: CalculationModel;
  principalBase: MoneyVnd;
  disbursementDate: DateOnly;
  monthlyDueDay: number;
  maturityDate: DateOnly;
  rateValue: number;
  rateUnit: RateUnit;
  partialPeriodInterestMode: PartialPeriodInterestMode;
  adjustmentReason?: string;
  createdAt: string;
}

export interface ScheduleEntry {
  id: string;
  scheduleVersionId: string;
  periodStart: DateOnly;
  dueDate: DateOnly;
  expectedPrincipal: MoneyVnd;
  expectedInterest: MoneyVnd;
  status: EntryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransaction {
  id: string;
  loanId: string;
  scheduleEntryId?: string;
  receivedAt: DateOnly;
  principalAmount: MoneyVnd;
  interestAmount: MoneyVnd;
  note?: string;
  createdAt: string;
  status?: PaymentStatus;
  updatedAt?: string;
}

export interface PaymentSnapshot {
  scheduleEntryId?: string;
  receivedAt: DateOnly;
  principalAmount: MoneyVnd;
  interestAmount: MoneyVnd;
  note?: string;
}

export interface PaymentAdjustment {
  id: string;
  loanId: string;
  paymentId: string;
  replacementPaymentId?: string;
  action: "edit" | "void";
  reason: string;
  before: PaymentSnapshot;
  after?: PaymentSnapshot;
  createdAt: string;
}

export interface PaymentCorrectionMutation {
  original: PaymentTransaction;
  replacement: PaymentTransaction;
  adjustment: PaymentAdjustment;
}

export interface PaymentCancellationMutation {
  original: PaymentTransaction;
  adjustment: PaymentAdjustment;
}

export interface LoanLifecycleEvent {
  id: string;
  loanId: string;
  action: "settled" | "reopened";
  effectiveDate: DateOnly;
  reason?: string;
  createdAt: string;
}

export interface PromiseToPay {
  id: string;
  loanId: string;
  scheduleEntryId: string;
  promisedDate: DateOnly;
  promisedPrincipal?: MoneyVnd;
  promisedInterest?: MoneyVnd;
  note: string;
  status: PromiseStatus;
  createdAt: string;
  updatedAt: string;
}

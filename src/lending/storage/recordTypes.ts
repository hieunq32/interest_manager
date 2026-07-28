import type { GenericRecord } from "../../backup/types";
import type {
  Borrower,
  Loan,
  PaymentTransaction,
  PromiseToPay,
  ReminderSettings,
  ScheduleEntry,
  ScheduleVersion,
} from "../domain/types";

export const LENDING_RECORD_TYPES = {
  borrower: "lending.borrower",
  loan: "lending.loan",
  scheduleVersion: "lending.schedule-version",
  scheduleEntry: "lending.schedule-entry",
  payment: "lending.payment",
  promise: "lending.promise",
  reminderSettings: "lending.reminder-settings",
} as const;

export const LENDING_REMINDER_SETTINGS_RECORD_ID = "lending-reminder-settings";

export type LendingRecordType = (typeof LENDING_RECORD_TYPES)[keyof typeof LENDING_RECORD_TYPES];

export type LendingRecordData = {
  [LENDING_RECORD_TYPES.borrower]: Borrower;
  [LENDING_RECORD_TYPES.loan]: Loan;
  [LENDING_RECORD_TYPES.scheduleVersion]: ScheduleVersion;
  [LENDING_RECORD_TYPES.scheduleEntry]: ScheduleEntry;
  [LENDING_RECORD_TYPES.payment]: PaymentTransaction;
  [LENDING_RECORD_TYPES.promise]: PromiseToPay;
  [LENDING_RECORD_TYPES.reminderSettings]: ReminderSettings;
};

export type LendingDomainRecord<T extends LendingRecordType = LendingRecordType> = T extends LendingRecordType
  ? Omit<GenericRecord, "type" | "data"> & {
      type: T;
      data: LendingRecordData[T];
    }
  : never;

export function isLendingRecordType(type: string): type is LendingRecordType {
  return Object.values(LENDING_RECORD_TYPES).includes(type as LendingRecordType);
}

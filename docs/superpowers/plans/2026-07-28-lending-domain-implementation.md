# Lending Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add borrower, loan, schedule, payment, promise-to-pay, reminder, and Apple Calendar workflows to the existing local-first PWA.

**Architecture:** Keep the current IndexedDB-backed generic record store and add a typed lending domain above it. Keep date and money calculations in pure TypeScript modules so every rule can be tested without React or browser state. React screens consume repository and domain services; Apple Calendar receives generated `.ics` reminders but never becomes the financial source of truth.

**Tech Stack:** Existing Vite, React, TypeScript, Vitest, React Testing Library, IndexedDB through `idb`, `fake-indexeddb`, Web Crypto backup, and `lucide-react`. No new backend and no new required runtime dependency.

## Global Constraints

Every task in this plan inherits these decisions from the approved design spec:

- The app is private and single-user. There is no account system, multi-user permission model, or backend.
- IndexedDB is the source of truth. The app must remain usable offline after the first load.
- Reminders use the in-app dashboard and exported `.ics` events for Apple Calendar. No Web Push backend is introduced.
- The global reminder default is enabled, one day before due, at 08:00. Each loan can override enabled state, offset days, and reminder time.
- Overdue state is displayed in the app without repeated daily notifications. A promise-to-pay can also be exported as a calendar event.
- Each loan selects either interest-only with principal at final settlement or equal principal with flat interest on original principal.
- The first monthly due date is the configured due day strictly after disbursement. Invalid monthly due days resolve to the last day of that month.
- A maturity date is explicit and may differ from the monthly due day. It is the final schedule date. For equal-principal loans it replaces the regular due date in its month rather than creating a nearby extra installment.
- The first monthly period charges a full monthly interest amount. The final non-aligned period uses the per-loan full-period or calendar-day-prorated setting. Monthly proration uses actual days in each calendar month; daily rates use actual calendar days.
- Rates are stored per loan as either `%/month` or `%/day`. Money is integer VND; date-only values use `YYYY-MM-DD`; audit timestamps use ISO strings.
- A schedule revision preserves the previous version and payment history. A rate or rate-unit change requires a non-empty adjustment reason. Existing payments are never silently recalculated.
- Principal and interest are recorded as separate payment amounts. A promise-to-pay is not a payment and never reduces balances.
- Records with history are archived rather than physically deleted. Encrypted backup and restore must include all lending records and must not log passphrases, keys, or decrypted payloads.
- MVP excludes Web Push, arbitrary custom payment schedules, equal-total-payment calculations, external bank integrations, automatic notifications to borrowers, and automatic recalculation of old paid history.

---

## File Structure

Create these files:

```text
src/lending/domain/types.ts
src/lending/domain/money.ts
src/lending/domain/dateRules.ts
src/lending/domain/interest.ts
src/lending/domain/scheduleGenerator.ts
src/lending/domain/ledger.ts
src/lending/domain/revisions.ts
src/lending/domain/money.test.ts
src/lending/domain/dateRules.test.ts
src/lending/domain/interest.test.ts
src/lending/domain/scheduleGenerator.test.ts
src/lending/domain/ledger.test.ts
src/lending/domain/revisions.test.ts
src/lending/storage/recordTypes.ts
src/lending/storage/lendingRepository.ts
src/lending/storage/lendingRepository.test.ts
src/lending/reminders/reminderSettings.ts
src/lending/reminders/ical.ts
src/lending/reminders/reminderSettings.test.ts
src/lending/reminders/ical.test.ts
src/lending/ui/lendingLabels.ts
src/lending/ui/BorrowerList.tsx
src/lending/ui/BorrowerForm.tsx
src/lending/ui/BorrowerDetail.tsx
src/lending/ui/LoanForm.tsx
src/lending/ui/LoanDetail.tsx
src/lending/ui/PaymentForm.tsx
src/lending/ui/PromiseForm.tsx
src/lending/ui/ScheduleRevisionForm.tsx
src/lending/ui/Dashboard.tsx
src/lending/ui/ReminderSettings.tsx
src/app/routes.ts
src/app/routes.test.ts
```

Modify these existing files:

```text
src/storage/indexedDbRecordStore.ts
src/storage/indexedDbRecordStore.test.ts
src/backup/types.ts
src/backup/backupService.test.ts
src/app/App.tsx
src/app/App.test.tsx
src/styles/global.css
README.md
```

Do not add a runtime dependency. Reuse the current UI primitives, icon library, backup service, and test setup.

## Domain Contracts

Add the following shared types in `src/lending/domain/types.ts`. Keep these contracts stable so the pure domain, repository, and UI layers do not invent different representations.

```ts
export type DateOnly = string;
export type MoneyVnd = number;

export type CalculationModel =
  | "interest-only-final-principal"
  | "equal-principal-flat-interest";
export type RateUnit = "monthly" | "daily";
export type PartialPeriodInterestMode =
  | "full-period"
  | "calendar-day-prorated";
export type LoanStatus = "draft" | "active" | "settled" | "archived";
export type EntryStatus =
  | "upcoming"
  | "due"
  | "promised"
  | "partially-paid"
  | "overdue"
  | "paid";
export type PromiseStatus =
  | "open"
  | "fulfilled"
  | "cancelled"
  | "expired";

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
```

## Tasks

### Task 1: Add Domain Contracts, Money, and Date Rules

**Files:** Create `src/lending/domain/types.ts`, `src/lending/domain/money.ts`, `src/lending/domain/dateRules.ts`, `src/lending/domain/money.test.ts`, and `src/lending/domain/dateRules.test.ts`.

**Interfaces to expose:**

```ts
assertValidMoney(value: number, fieldName?: string): MoneyVnd
roundMoney(value: number): MoneyVnd
isDateOnly(value: string): boolean
compareDateOnly(left: DateOnly, right: DateOnly): number
daysInMonth(year: number, month: number): number
resolveDueDate(year: number, month: number, dueDay: number): DateOnly
nextDueDateAfter(date: DateOnly, dueDay: number): DateOnly
differenceInCalendarDays(start: DateOnly, end: DateOnly): number
```

**TDD steps:**

- [ ] Write failing money tests for integer VND rounding, safe non-negative values, rejection of `NaN`, infinity, negative values, and non-finite rate inputs.
- [ ] Implement `roundMoney` and `assertValidMoney` with explicit validation errors and no floating-point values crossing the persistence boundary.
- [ ] Write failing date tests for day 31 resolving to month end, February leap-year behavior, strict-next due date behavior, date comparison, and calendar-day differences.
- [ ] Implement UTC-based date-only helpers. Do not parse a date-only string through `new Date("YYYY-MM-DD")`, because browser timezone conversion can change the calendar date.
- [ ] Add range checks for month, due day, and date-only format; reject an end date before a start date.
- [ ] Run the focused tests and typecheck.
- [ ] Commit as `feat: add lending domain primitives`.

**Acceptance:** The domain has no React or browser dependency, date calculations are timezone-stable on iPhone and desktop, and all primitive edge cases are covered by tests.

### Task 2: Implement Monthly and Daily Interest Calculations

**Files:** Create `src/lending/domain/interest.ts` and `src/lending/domain/interest.test.ts`.

**Interfaces to expose:**

```ts
export interface InterestCalculationInput {
  principalBase: MoneyVnd;
  rateValue: number;
  rateUnit: RateUnit;
  periodStart: DateOnly;
  periodEnd: DateOnly;
  isFirstPeriod: boolean;
  isFinalPeriod: boolean;
  partialPeriodInterestMode: PartialPeriodInterestMode;
}

calculatePeriodInterest(input: InterestCalculationInput): MoneyVnd
calculateMonthlyProratedInterest(
  principalBase: MoneyVnd,
  monthlyRate: number,
  periodStart: DateOnly,
  periodEnd: DateOnly,
): MoneyVnd
```

**TDD steps:**

- [ ] Write a failing monthly test proving a regular first period charges one full month: 10,000,000 VND at 2% from `2026-06-20` to `2026-07-05` returns 200,000 VND.
- [ ] Write a failing final-period proration test: 10,000,000 VND at 2% from `2026-04-05` to `2026-04-15` returns 66,667 VND after one final rounding step.
- [ ] Write a failing cross-month proration test proving each calendar-month segment is divided by that month’s actual number of days, then the unrounded segments are summed and rounded once.
- [ ] Write a failing daily-rate test: 10,000,000 VND at `0.1%/day` for 15 calendar days returns 150,000 VND.
- [ ] Implement monthly full-period, monthly calendar-day-prorated, and daily actual-day branches. Daily mode must not use the monthly partial-period setting.
- [ ] Reject negative rates and invalid period boundaries. Keep intermediate values unrounded until the documented final rounding point.
- [ ] Run focused tests, the full test suite, and typecheck.
- [ ] Commit as `feat: add lending interest calculations`.

**Implementation note:** The UI may accept `2%` and persist `0.02`; the domain receives the normalized decimal rate. The same rule applies to daily percentages.

**Acceptance:** The calculation engine reproduces the approved examples and cannot silently charge a daily rate as monthly or apply a first-period proration.

### Task 3: Generate Deterministic Loan Schedules

**Files:** Create `src/lending/domain/scheduleGenerator.ts` and `src/lending/domain/scheduleGenerator.test.ts`.

**Interfaces to expose:**

```ts
buildScheduleDates(version: ScheduleVersion): DateOnly[]
generateSchedule(version: ScheduleVersion): ScheduleEntry[]
```

Use deterministic entry IDs derived from the schedule version and due date, for example `scheduleVersionId:YYYY-MM-DD`. This makes repeated previews stable while preserving each revision as a separate version.

**TDD steps:**

- [ ] Write a failing equal-principal date test for disbursement `2026-06-20`, due day 5, maturity `2026-12-15`; expect `05/07`, `05/08`, `05/09`, `05/10`, `05/11`, and `15/12` only.
- [ ] Write a failing principal allocation test proving equal principal is split across entries and the remainder is placed in the final entry; for 10,000,001 VND over six entries expect five allocations of 1,666,666 and a final 1,666,671.
- [ ] Write a failing interest-only test proving regular entries have zero principal and the maturity entry contains the full principal plus the final interest period.
- [ ] Write failing day-31 tests for February, April, and leap February.
- [ ] Implement date generation using the approved maturity-month rules: equal-principal schedules include regular dates only in months before the maturity month, then maturity once; interest-only schedules include regular interest dates before maturity and add maturity once, including a maturity-month due date only when it is earlier than maturity.
- [ ] Use `effectiveDate` as the schedule-generation boundary for a version; the first version sets it to the disbursement date, and a revision generates only future entries strictly after its effective boundary. Use the boundary as the first period start and the previous due date thereafter.
- [ ] The next period-start rule is for the initial version only; a revised version must use its `effectiveDate` boundary as specified above.
- [ ] Implement period starts as disbursement date for the first entry and the previous due date thereafter. Calculate each entry’s expected interest through `calculatePeriodInterest`.
- [ ] Initialize generated entries as `upcoming`; do not derive payment status inside the generator.
- [ ] Run schedule tests, interest tests, full tests, and typecheck.
- [ ] Commit as `feat: generate lending schedules`.

**Acceptance:** Schedule previews and saved schedules are deterministic, the final date is exact, no extra installment is created near maturity, and expected principal totals exactly equal the principal base.

### Task 4: Add Ledger Status, Loan Summaries, and Schedule Revisions

**Files:** Create `src/lending/domain/ledger.ts`, `src/lending/domain/revisions.ts`, `src/lending/domain/ledger.test.ts`, and `src/lending/domain/revisions.test.ts`.

**Interfaces to expose:**

```ts
export interface EntryTotals {
  receivedPrincipal: MoneyVnd;
  receivedInterest: MoneyVnd;
  outstandingPrincipal: MoneyVnd;
  outstandingInterest: MoneyVnd;
}

export interface LoanSummary {
  loanId: string;
  outstandingPrincipal: MoneyVnd;
  outstandingInterest: MoneyVnd;
  dueToday: number;
  dueSoon: number;
  overdue: number;
  nextDueDate?: DateOnly;
}

calculateEntryTotals(
  entry: ScheduleEntry,
  payments: PaymentTransaction[],
): EntryTotals
calculateEntryStatus(input: {
  entry: ScheduleEntry;
  payments: PaymentTransaction[];
  promises: PromiseToPay[];
  today: DateOnly;
}): EntryStatus
calculateLoanSummary(input: {
  loanId: string;
  entries: ScheduleEntry[];
  payments: PaymentTransaction[];
  promises: PromiseToPay[];
  today: DateOnly;
}): LoanSummary

export interface RevisionInput {
  previous: ScheduleVersion;
  effectiveDate: DateOnly;
  changes: Partial<
    Pick<
      ScheduleVersion,
      | "calculationModel"
      | "principalBase"
      | "disbursementDate"
      | "monthlyDueDay"
      | "maturityDate"
      | "rateValue"
      | "rateUnit"
      | "partialPeriodInterestMode"
    >
  >;
  adjustmentReason?: string;
  createdAt: string;
}

validateRevisionReason(input: {
  previous: ScheduleVersion;
  next: ScheduleVersion;
  adjustmentReason?: string;
}): void
createScheduleRevision(input: RevisionInput): {
  version: ScheduleVersion;
  entries: ScheduleEntry[];
  activeScheduleVersionId: string;
}
```

**TDD steps:**

- [ ] Write failing ledger tests proving principal and interest totals are independent, multiple payments aggregate, and overpayment is capped at zero outstanding for display.
- [ ] Write failing status tests for upcoming, due, paid, partially-paid, overdue, open future promise, and expired promise. Use the approved precedence: fully paid, open promise, overdue, partially paid, due, upcoming.
- [ ] Write a failing summary test for outstanding balances, due today count, due soon count, overdue count, and next due date.
- [ ] Write a failing revision test proving a rate or rate-unit change without a trimmed reason is rejected.
- [ ] Write a failing revision test proving a date or maturity change is allowed without a reason, version numbers increment, old versions remain untouched, and new entries are generated from the new version.
- [ ] Implement ledger aggregation by `scheduleEntryId`; payments without an entry remain visible in transaction history but do not alter an unrelated entry.
- [ ] Implement promise expiry as a derived/status transition rule. Do not mutate the original due date when a borrower promises to pay later.
- [ ] Implement immutable revision creation. Compare old and new rate fields, require a reason only for rate or unit changes, and never recalculate existing payment records.
- [ ] Apply a revision only from its `effectiveDate`: keep prior entries before that date attached to the old version, generate the new version's future entries from the effective boundary, and make the active-version pointer explicit.
- [ ] Run focused tests, full tests, and typecheck.
- [ ] Commit as `feat: add lending ledger and schedule revisions`.

**Acceptance:** Every balance is explainable from schedule entries and transactions, overdue state is derived without notification spam, and schedule changes preserve an auditable version history.

### Task 5: Add Typed Persistence and Backup Integration

**Files:** Create `src/lending/storage/recordTypes.ts`, `src/lending/storage/lendingRepository.ts`, and `src/lending/storage/lendingRepository.test.ts`. Modify `src/storage/indexedDbRecordStore.ts`, `src/storage/indexedDbRecordStore.test.ts`, `src/backup/types.ts`, and `src/backup/backupService.test.ts`.

**Repository interface:**

```ts
export interface LendingRepository {
  listBorrowers(): Promise<Borrower[]>;
  saveBorrower(value: Borrower): Promise<void>;
  listLoans(borrowerId?: string): Promise<Loan[]>;
  saveLoan(value: Loan): Promise<void>;
  listScheduleVersions(loanId?: string): Promise<ScheduleVersion[]>;
  saveScheduleVersion(value: ScheduleVersion): Promise<void>;
  listScheduleEntries(scheduleVersionId?: string): Promise<ScheduleEntry[]>;
  saveScheduleEntries(values: ScheduleEntry[]): Promise<void>;
  saveLoanBundle(input: {
    loan: Loan;
    version: ScheduleVersion;
    entries: ScheduleEntry[];
  }): Promise<void>;
  listPayments(loanId?: string): Promise<PaymentTransaction[]>;
  savePayment(value: PaymentTransaction): Promise<void>;
  listPromises(loanId?: string): Promise<PromiseToPay[]>;
  savePromise(value: PromiseToPay): Promise<void>;
  listAllDomainRecords(): Promise<GenericRecord[]>;
  replaceAllDomainRecords(values: GenericRecord[]): Promise<void>;
}
```

**TDD steps:**

- [ ] Add record-type constants and a typed mapping for `borrower`, `loan`, `schedule-version`, `schedule-entry`, `payment`, `promise`, and `reminder-settings`.
- [ ] Extend `IndexedDbRecordStore` with `listRecordsByType(type)`, `upsertRecords(records)`, and `deleteRecord(id)` while reusing the existing object store and indexes. Preserve current `getHealth`, `replaceRecords`, and backup behavior.
- [ ] Add repository round-trip tests for every entity type, borrower filtering, loan filtering, schedule-version filtering, schedule-entry filtering, and payment/promise filtering.
- [ ] Add a batch-write test proving schedule entries are persisted atomically from the repository’s perspective and repeated writes replace by record ID.
- [ ] Update backup types only as needed to accept the domain record union without weakening the existing encrypted outer envelope validation.
- [ ] Add a backup test that saves a borrower, loan, version, entries, payment, promise, and settings, exports an encrypted backup, restores it into a clean store, and compares all domain records.
- [ ] Ensure repository and backup code never logs raw passphrases, crypto keys, or decrypted backup payloads.
- [ ] Run storage, backup, full tests, and typecheck.
- [ ] Commit as `feat: persist lending domain records`.

**Acceptance:** Refresh, offline reload, encrypted backup, and restore preserve the complete lending history with stable typed records.

### Task 6: Implement Reminder Settings and Apple Calendar Export

**Files:** Create `src/lending/reminders/reminderSettings.ts`, `src/lending/reminders/ical.ts`, `src/lending/reminders/reminderSettings.test.ts`, and `src/lending/reminders/ical.test.ts`.

**Interfaces to expose:**

```ts
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  offsetDays: 1,
  time: "08:00",
};

resolveReminderSettings(
  globalSettings: ReminderSettings,
  override?: ReminderOverride,
): ReminderSettings

export interface CalendarEventInput {
  uid: string;
  date: DateOnly;
  time: string;
  summary: string;
  description: string;
  reminderOffsetDays: number;
  dtstampUtc: string;
}

buildIcsCalendar(events: CalendarEventInput[]): string
buildScheduleCalendarEvents(input: {
  entries: ScheduleEntry[];
  promises: PromiseToPay[];
  borrowerName: string;
  loanLabel: string;
  settings: ReminderSettings;
  today: DateOnly;
}): CalendarEventInput[]
```

**TDD steps:**

- [ ] Write failing settings tests for the default, enabled override, disabled override, custom offset, custom time, and invalid offset/time rejection.
- [ ] Write a failing ICS test proving `VCALENDAR`/`VEVENT` output contains stable UID, local reminder time converted from Asia/Ho_Chi_Minh to UTC, `TRIGGER:-P1D`, and CRLF line endings.
- [ ] Write a failing escaping test for commas, semicolons, backslashes, and newlines in borrower names, notes, and descriptions.
- [ ] Write a failing event-selection test that excludes fully paid schedule entries and closed promises, includes due entries and open promise dates, and marks events with a stable description.
- [ ] Write a failing purity test proving event selection uses the supplied Vietnam `today` date, includes an open future promise even when its linked entry is paid, and serializes a deterministic `DTSTAMP` for every event.
- [ ] Implement deterministic `.ics` serialization. Use a fixed `PRODID`, CRLF separators, UTC `DTSTART`, and escaped text fields. Vietnam has no DST, so convert configured local time by subtracting seven hours.
- [ ] Implement download helpers at the UI boundary only. The domain/reminder module returns text and does not access `document`.
- [ ] Return stable schedule-version/event identity metadata from this domain module. The stale-calendar state and re-export warning are rendered and persisted by the Task 8/9 UI workflow after a schedule revision; do not add browser state here.
- [ ] Run focused tests, full tests, and typecheck.
- [ ] Commit as `feat: export lending reminders to Calendar`.

**Acceptance:** The lender can export a useful Apple Calendar file for future due dates and promise dates, with no server account or paid notification service.

### Task 7: Add Offline Routing, Borrower Management, and Loan Onboarding

**Files:** Create `src/app/routes.ts`, `src/app/routes.test.ts`, `src/lending/ui/lendingLabels.ts`, `src/lending/ui/BorrowerList.tsx`, `src/lending/ui/BorrowerForm.tsx`, `src/lending/ui/BorrowerDetail.tsx`, `src/lending/ui/LoanForm.tsx`. Modify `src/app/App.tsx`, `src/app/App.test.tsx`, `src/lending/storage/lendingRepository.ts`, and `src/lending/storage/lendingRepository.test.ts`.

**Interfaces and screen behavior:**

```ts
export type Route =
  | { name: "dashboard" }
  | { name: "borrower"; borrowerId: string }
  | { name: "loan"; loanId: string }
  | { name: "settings" };

parseHashRoute(hash: string):
  | { name: "dashboard" }
  | { name: "borrower"; borrowerId: string }
  | { name: "loan"; loanId: string }
  | { name: "settings" };

serializeHashRoute(route: Route): string;

BorrowerFormProps: { value?: Borrower; onSave(value: Borrower): Promise<void> }
BorrowerListProps: { borrowers: Borrower[]; onSelect(id: string): void }

export interface LoanDraft {
  borrowerId: string;
  calculationModel: CalculationModel;
  originalPrincipal: MoneyVnd;
  disbursementDate: DateOnly;
  monthlyDueDay: number;
  maturityDate: DateOnly;
  rateValue: number;
  rateUnit: RateUnit;
  partialPeriodInterestMode: PartialPeriodInterestMode;
  reminderOverride?: ReminderOverride;
  note?: string;
}

LoanFormProps: { borrowerId: string; onSave(input: LoanDraft): Promise<void> }
```

**TDD steps:**

- [ ] Write route tests for dashboard, borrower detail, loan detail, settings, unknown hash fallback, and encoded IDs.
- [ ] Write a borrower form test covering required display name, optional phone/note, validation, save callback, and archive behavior.
- [ ] Write a loan form test covering principal, disbursement date, model selection, due day, maturity date, rate value, rate unit, partial-period mode, reminder override, and note.
- [ ] Add a schedule preview test for 10,000,000 VND, disbursed `2026-06-20`, model 2, due day 5, maturity `2026-12-15`, 2% monthly; preview must show six entries before confirmation.
- [ ] Implement hash routing so browser reload and offline navigation work without a server-side router.
- [ ] Implement borrower list/create/detail flows with the existing UI primitives and Lucide icons. Use archive actions rather than destructive deletion.
- [ ] Implement loan creation as a draft/preview/confirm flow: normalize percentage input, validate dates and amount, create the first schedule version, generate entries, then save loan/version/entries together through the repository.
- [ ] Implement `saveLoanBundle` with one IndexedDB read-write transaction and use it after confirmation so a loan cannot be persisted without its initial schedule version and entries.
- [ ] Add navigation links from borrower detail to its loans and from loan creation back to borrower detail.
- [ ] Make the dashboard the first usable screen after the base storage smoke UI is replaced.
- [ ] Run UI tests, full tests, typecheck, and production build.
- [ ] Commit as `feat: add borrower and loan onboarding`.

**Acceptance:** A lender can create a borrower and a loan while offline, preview the exact schedule before saving, refresh the page, and return to the same records.

### Task 8: Add Loan Detail, Payments, Promises, and Revisions UI

**Files:** Create `src/lending/ui/LoanDetail.tsx`, `src/lending/ui/PaymentForm.tsx`, `src/lending/ui/PromiseForm.tsx`, `src/lending/ui/ScheduleRevisionForm.tsx`, plus focused UI tests for each. Modify `src/lending/ui/BorrowerDetail.tsx` and `src/app/App.tsx`.

**Interfaces and screen behavior:**

```ts
PaymentFormProps: {
  loanId: string;
  scheduleEntryId: string;
  onSave(value: PaymentTransaction): Promise<void>;
}

PromiseFormProps: {
  loanId: string;
  scheduleEntryId: string;
  onSave(value: PromiseToPay): Promise<void>;
}

ScheduleRevisionFormProps: {
  current: ScheduleVersion;
  onSave(input: RevisionInput): Promise<void>;
}
```

**TDD steps:**

- [ ] Write a payment form test proving principal and interest are separate fields, at least one amount is positive, invalid money is rejected, and the received date/note are retained.
- [ ] Write a promise form test proving promised date and note are required, optional promised principal/interest are stored, and saving a promise does not change ledger balances.
- [ ] Write a revision form test proving a rate or unit change is blocked without a reason, while a due-date or maturity-date change can be saved without one.
- [ ] Implement loan detail sections for current balance, next due date, due/overdue counts, schedule-version history, payment history, promise history, and schedule rows.
- [ ] Add per-entry actions for record payment, record promise, mark promise fulfilled/cancelled, and open a revision flow. Keep the original due date visible when a promise is late.
- [ ] Show principal and interest expected/received/outstanding separately. Do not merge them into one opaque total.
- [ ] Show old schedule versions read-only and label the active version. Existing payments remain attached to their original entry/version.
- [ ] Add the Calendar export action/state and show stale-export state after a revision. This task prepares the pure `.ics` content and export metadata; the browser Blob download is wired by Task 9.
- [ ] Refresh derived statuses and summaries after each mutation without requiring a full page reload.
- [ ] Run focused UI tests, full tests, typecheck, and production build.
- [ ] Commit as `feat: add lending payment and revision workflows`.

**Acceptance:** The daily workflow is usable from one loan detail screen: see what is due, record separate money components, note a promised date, and revise terms without destroying history.

### Task 9: Add Dashboard, Settings, Calendar Download, and Backup UX

**Files:** Create `src/lending/ui/Dashboard.tsx`, `src/lending/ui/ReminderSettings.tsx`, and focused tests. Modify `src/lending/ui/LoanDetail.tsx`, `src/app/App.tsx`, `src/app/App.test.tsx`, `src/styles/global.css`, `src/backup/backupService.test.ts`, and `README.md`.

**Interfaces and workflows:**

```ts
DashboardProps: { summaries: LoanSummary[]; onOpenLoan(id: string): void }
ReminderSettingsProps: {
  value: ReminderSettings;
  onSave(value: ReminderSettings): Promise<void>;
}
```

**TDD steps:**

- [ ] Write dashboard tests for due today, due soon, promised, overdue, and empty states. Ensure overdue is visible but no repeated-notification queue is created.
- [ ] Write settings tests for global reminder enabled state, default time, offset days, invalid values, and persistence across reload.
- [ ] Write Calendar-download tests for a deterministic filename `interest-manager-calendar-YYYY-MM-DD.ics`, correct MIME type, and no paid/closed events.
- [ ] Add an integration test for the App backup flow: domain records are exported through the existing encrypted backup service, a destructive test reset is performed through the existing repository API, restore runs through explicit confirmation, and all domain data returns.
- [ ] Implement the dashboard as the primary screen with concise sections for due today, upcoming, promises, overdue, and active-loan totals. Keep controls compact and use clear status colors with text labels for accessibility.
- [ ] Implement Settings with global reminder time, offset days, enabled toggle, backup/export, restore/import, and storage health. Keep per-loan override controls on the loan form/detail.
- [ ] Implement Calendar export as a browser download using a Blob and object URL, revoke the URL after download, and show success/error feedback without logging the file contents.
- [ ] Wire App startup to load typed records and derive current statuses from today’s local date. Keep the data path offline-first; online state remains informational only.
- [ ] Update CSS for phone-sized layouts, stable row dimensions, readable VND formatting, accessible focus states, and no overlapping controls. Reuse the existing visual language and avoid adding decorative marketing sections.
- [ ] Update README with the local-first data model, backup/restore steps, Apple Calendar export workflow, reminder limitations, and the exact calculation assumptions.
- [ ] Run focused tests, full tests, typecheck, and production build.
- [ ] Commit as `feat: add lending management workflows`.

**Acceptance:** The app opens to an actionable dashboard, supports global and per-loan reminder settings, exports calendar events, and exposes encrypted backup/restore from Settings without requiring a backend.

### Task 10: Verify the Complete Offline Recovery Workflow

**Files:** No planned file changes. If verification reveals a defect, add a focused regression test first, make the smallest fix, and commit it separately as `fix: address lending verification finding`.

**Verification steps:**

- [ ] Run `npm test` and confirm all unit/UI/backup tests pass.
- [ ] Run `npm run typecheck` and confirm no TypeScript errors.
- [ ] Run `npm run build` and confirm the production bundle contains the manifest, service worker, and icon assets.
- [ ] Start the preview server on an unused local port and verify the root page, manifest, service worker, and app shell return HTTP 200.
- [ ] Create borrower `Nguyen Van A`.
- [ ] Create a 10,000,000 VND model-2 loan, disbursed `2026-06-20`, due day 5, maturity `2026-12-15`, rate 2% per month.
- [ ] Confirm the preview and saved schedule dates are `2026-07-05`, `2026-08-05`, `2026-09-05`, `2026-10-05`, `2026-11-05`, and `2026-12-15`.
- [ ] Confirm total expected principal is exactly 10,000,000 VND and total expected interest contains six collection periods; full-period mode yields six full monthly charges, while calendar-day-prorated mode prorates the final `2026-11-05` to `2026-12-15` period.
- [ ] Record a payment of 800,000 VND principal and 200,000 VND interest, then verify the two outstanding balances update independently.
- [ ] Add a promise for `2026-09-17` with note `Mai tra`, then verify it appears in promises and does not reduce outstanding balances.
- [ ] Move the app date/test fixture past the promise date and verify the entry displays overdue without generating repeated notifications.
- [ ] Attempt a rate revision without a reason and verify it is blocked; add a reason, save the revision, and verify the old version and its history remain visible.
- [ ] Export `.ics`, inspect that due and promise events exist, and verify paid entries are excluded.
- [ ] Export an encrypted backup, clear through the app’s explicit reset flow, restore the backup, and confirm borrower, loan, versions, entries, payment, promise, and settings all return.
- [ ] Use browser offline mode and repeat dashboard navigation, loan detail, payment entry, and backup restore read access.
- [ ] Review `git diff --check`, `git status --short`, and `git log --oneline -10` before declaring the implementation complete.

**Acceptance:** The full vertical slice works offline, calendar output is usable on iPhone, and encrypted restore recovers the complete audit trail on a fresh local store.

## Spec Coverage Checklist

Use this checklist during implementation review:

- [ ] One lender, one borrower with multiple loans, archive instead of destructive delete.
- [ ] Model 1: periodic interest with principal at final settlement.
- [ ] Model 2: equal principal with flat interest on original principal.
- [ ] Monthly `%/month` and daily `%/day` rates.
- [ ] Per-loan due day, invalid day to month end, and exact maturity date.
- [ ] First due date strictly after disbursement and calendar-based monthly collection.
- [ ] Maturity date replaces the regular maturity-month installment where required.
- [ ] Full first monthly interest and selectable final-period proration.
- [ ] Actual calendar-day monthly proration and actual-day daily interest.
- [ ] Schedule revisions with immutable old versions and required reason only for rate/unit changes.
- [ ] Separate principal and interest payment recording.
- [ ] Multiple payments per schedule entry and partial-payment state.
- [ ] Promise-to-pay with note, promised date, status, and no balance reduction.
- [ ] Overdue displayed in app without repeated notifications.
- [ ] Global reminder settings and per-loan overrides.
- [ ] In-app dashboard plus Apple Calendar `.ics` export.
- [ ] Offline IndexedDB operation and encrypted backup/restore recovery.
- [ ] No backend, no paid service, and no new runtime dependency.

## Final Review Gates

Before implementation is considered complete, review the resulting changes against the approved spec and this plan:

- [ ] Every domain rule has a focused automated test and at least one UI path where the rule is user-visible.
- [ ] No UI component performs money or date arithmetic directly; it calls the domain layer.
- [ ] No schedule revision mutates old records or payment history.
- [ ] No reminder path creates repeated overdue notifications.
- [ ] No backup path exposes passphrases, keys, decrypted data, or raw financial records in logs.
- [ ] The app remains usable at iPhone-width viewports and in browser offline mode.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` pass after the final change.

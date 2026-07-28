# Task 4 Report: Ledger Status, Summaries, and Schedule Revisions

## Delivered

- Added pure entry-ledger totals that aggregate payments only by `scheduleEntryId`, keep principal and interest independent, and cap display balances at zero after overpayment.
- Added derived entry statuses with the required precedence: paid, open future promise, overdue, partially paid, due, and upcoming. Open promises at or before today are treated as expired for status derivation without changing the schedule entry due date or mutating promise records.
- Added loan summaries for independent outstanding balances, due-today, seven-day due-soon, overdue, and next unresolved due date.
- Added immutable revision creation. Rate or rate-unit changes require a trimmed reason; other approved changes do not. Revisions increment the version number, receive a distinct deterministic ID, retain the prior object unchanged, and generate only future entries from the new effective-date boundary through `generateSchedule`.

## Tests

- Added focused ledger tests for component-wise multiple payments, ignored unassigned payments, overpayment display, every required status case, promise expiry, and summary values.
- Added focused revision tests for missing rate/rate-unit reasons and immutable maturity-date revisions with generated new-version entries.
- `npm test -- src/lending/domain/ledger.test.ts src/lending/domain/revisions.test.ts`: 2 files passed, 11 tests passed.
- `npm test`: 11 files passed, 62 tests passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.

## Concerns

- `ScheduleEntry` does not include `loanId`, and `calculateLoanSummary` receives no loan ID. The summary therefore derives `loanId` from the first payment or promise, returning an empty string when neither exists. A future contract revision should include `loanId` in the summary input if summaries for untouched loans must carry an ID.

## Loan ID Fix

The approved contract now requires `loanId` in `calculateLoanSummary(input)`. The summary returns that supplied ID directly and no longer infers identity from payment or promise history. Added a regression test for an active loan with entries but no payments or promises.

### Commands and Output

- `npm test -- src/lending/domain/ledger.test.ts src/lending/domain/revisions.test.ts`
  - 2 files passed, 12 tests passed.
- `npm run typecheck`
  - `tsc --noEmit` completed successfully.
- `npm test`
  - 11 files passed, 63 tests passed.

### Remaining Concerns

None.

## Review Fix Round 1

- Open promises are now future only when their promised date is strictly after today. An unpaid entry with an open promise due today derives as overdue, without mutating the promise or original due date.
- `createScheduleRevision` now returns `activeScheduleVersionId`, equal to the newly created version ID, so repository and UI layers can explicitly update `Loan.defaultScheduleVersionId` while preserving historical versions and payments.

### Commands and Output

- `npm test -- src/lending/domain/ledger.test.ts src/lending/domain/revisions.test.ts`
  - 2 files passed, 13 tests passed.
- `npm run typecheck`
  - `tsc --noEmit` completed successfully.
- `npm test`
  - 11 files passed, 64 tests passed.

### Remaining Concerns

None.

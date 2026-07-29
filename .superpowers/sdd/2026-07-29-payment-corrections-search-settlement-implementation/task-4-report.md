# Task 4 Report

## Delivered

- Added the optional `Loan.settledAt` date.
- Added pure settlement eligibility, settlement, and reopening domain functions.
- Settlement requires an active loan with zero outstanding principal and interest, preserves the selected settlement date, and emits a `settled` lifecycle event.
- Reopening requires a settled loan and a nonblank reason, clears `settledAt`, and emits a `reopened` lifecycle event.
- Neither lifecycle function creates payments or changes the schedule.

## TDD Evidence

- Eligibility tests first failed because the lifecycle module was absent, then passed after the minimal eligibility implementation.
- Settlement and reopening tests then failed because their exports were absent, then passed after the lifecycle transformations were added.

## Verification

- `npm test -- src/lending/domain/loanLifecycle.test.ts src/lending/domain/ledger.test.ts src/lending/domain/paymentCorrections.test.ts`: 35 passing tests.
- `npm run typecheck`: passed.
- `git diff --check`: passed.

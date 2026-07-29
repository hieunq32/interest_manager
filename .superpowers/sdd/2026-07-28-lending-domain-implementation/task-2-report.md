# Task 2 Implementation Report

## Changed files

- `src/lending/domain/interest.ts`
- `src/lending/domain/interest.test.ts`

## Design choices

- Added the requested pure domain APIs for period interest and monthly calendar-day proration, with no React, browser, storage, schedule, or UI dependencies.
- Rate values are treated as normalized decimals. Monthly first periods always charge one full monthly rate, even when the partial-period mode requests proration.
- Monthly final-period proration splits the exclusive-end date interval at calendar-month boundaries, divides each segment by that month’s actual day count, sums unrounded segment values, and rounds once at the end.
- Daily interest uses the actual calendar-day difference and does not consult the monthly partial-period mode.
- Principal, rate, rate unit, partial-period mode, date boundaries, and final money results are validated at the domain boundary. Negative and non-finite rates are rejected.

## Tests and commands

- `npm test -- src/lending/domain/interest.test.ts`
  - 1 test file passed, 10 tests passed.
- `npm run typecheck`
  - `tsc --noEmit` completed successfully.
- `npm test`
  - 8 test files passed, 44 tests passed.

## Concerns

None identified for this task. Periods use the existing date-rule convention where the end date is exclusive, matching the approved 10-day April proration example.

## Round 1 Fix

### Changed files

- `src/lending/domain/interest.ts`
- `src/lending/domain/interest.test.ts`
- `.superpowers/sdd/2026-07-28-lending-domain-implementation/task-2-report.md`

The monthly month-boundary helper now returns no next month for `9999-12`, allowing the valid period end to close the final segment without constructing invalid `10000-01-01`. Added a regression test for `9999-12-01` through `9999-12-15`; exclusive-end and one-final-rounding behavior remain unchanged.

### Commands and output

- `npm test -- src/lending/domain/interest.test.ts`
  - 1 test file passed, 11 tests passed.
- `npm run typecheck`
  - `tsc --noEmit` completed successfully.
- `npm test`
  - 8 test files passed, 45 tests passed.

### Concerns

None identified.

# Task 3 Report: Deterministic Loan Schedules

## Delivered

- Added `buildScheduleDates(version)` for deterministic monthly due-date generation.
- Added `generateSchedule(version)` for deterministic schedule entry IDs, principal allocations, expected interest, and `upcoming` status.
- Equal-principal schedules omit the regular maturity-month due date and use the exact maturity date.
- Interest-only schedules retain an earlier maturity-month due date, then append maturity once.
- Revised versions generate entries strictly after `effectiveDate`; their first interest period starts at that boundary.
- Principal remainders are assigned to the final equal-principal entry.

## Tests

- Added focused schedule tests for maturity-month handling, equal-principal remainder allocation, interest-only maturity principal and interest, day-31 resolution through February/April/leap February, deterministic IDs/status, and revision boundaries.
- `npm test -- src/lending/domain/scheduleGenerator.test.ts` passed: 6 tests.
- `npm test -- src/lending/domain/interest.test.ts` passed: 11 tests.
- `npm test` passed: 51 tests across 9 files.
- `npm run typecheck` passed.

## Scope

No ledger, revision persistence, storage, or UI work was added.

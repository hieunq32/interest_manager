# Task 8 Report: Lending Payment And Revision Workflows

## Status

Completed in `C:\SourceCode\interest_manager\.worktrees\lending-domain`.

## Delivered

- Added `LoanDetail`, `PaymentForm`, `PromiseForm`, and `ScheduleRevisionForm`.
- Wired loan routes to load typed schedule versions, entries, payments, and promises through `IndexedDbLendingRepository`.
- Added payment recording with separate principal and interest integer VND inputs, required received date, optional trimmed note, and a positive-component requirement.
- Added promise recording with required date and note, optional promised components, and no ledger mutation.
- Added per-entry payment/promise actions, promise fulfil/cancel actions, immutable payment history, promise history, and read-only historical schedule versions.
- Used `calculateEntryTotals`, `calculateEntryStatus`, and `calculateLoanSummary` for displayed balances and statuses.
- Added revision entry with conditional trimmed adjustment-reason validation, immutable new schedule-version creation, generated future entries, and `Loan.defaultScheduleVersionId` update.
- Preserved original due dates in schedule rows, including when a promise becomes overdue.
- Added Calendar export-state UI. The active export version is persisted as typed optional `Loan.calendarExportVersionId`; revisions leave that prior version in place, producing a stale re-export warning.
- Kept encrypted backup behavior and the existing persistence primitives unchanged.

## Tests Added

- `PaymentForm.test.tsx`: separate payment components, positive/valid money validation, retained date and note.
- `PromiseForm.test.tsx`: required promise date/note, optional promised components, and unchanged ledger balance.
- `ScheduleRevisionForm.test.tsx`: required reason for rate/unit changes and reason-free maturity revision.
- `LoanDetail.test.tsx`: derived separate balances, overdue original due date, schedule-version labels, read-only history, promise actions, and stale Calendar state.
- Extended `App.test.tsx`: persisted payment, revision/version history, active-version update, and persisted Calendar export version.

## TDD Evidence

1. Added the four new focused test files before their production components; the initial focused run failed because the modules did not exist.
2. Implemented the forms and detail screen until those focused tests passed.
3. Added the App workflow regression before App wiring; it failed because the prior detail route had no payment action.
4. Added the persisted Calendar export assertion; it failed against the in-memory-only state, then passed after adding the typed loan field and persistence wiring.

## Verification

- Focused payment/promise/revision/detail UI tests: 4 files, 7 tests passed.
- `src/app/App.test.tsx`: 8 tests passed.
- `npm test`: 20 files, 107 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite emitted the PWA manifest and service worker.
- `git diff --check`: passed.

## Self-Review

- Payment and promise records are created as typed immutable event records; promise status changes are the supported state transition on the promise record and do not create payments.
- React delegates money totals, balances, due counts, and status precedence to the domain ledger functions.
- Revision persistence writes a new version and new entries, does not overwrite old entries or payments, and explicitly updates only the loan's active-version pointer plus audit timestamp.
- No runtime dependencies were added.
- No dashboard/settings or browser `.ics` download polish was implemented; Calendar file download remains Task 9 scope. Task 8 persists and exposes the re-export state/action.

## Fix Round 1

### Reviewer Findings Addressed

1. The loan-detail summary now passes all loan schedule entries to `calculateLoanSummary`. Schedule rows stay grouped into active and read-only historical versions, while payments on immutable historical entries reduce the combined displayed balance.
2. `App` now builds reminder events with `buildScheduleCalendarEvents`, serializes them with `buildIcsCalendar`, and passes `{ content, loanId, scheduleVersionId }` to the optional `onCalendarExport` Task 9 download boundary before persisting the export version. A preparation or boundary failure sets `Calendar export could not be prepared` and does not mark the export current.
3. Revisions now persist the revised loan pointer, new schedule version, and generated entries with `saveLoanBundle`. The existing bundle transaction retains prior versions and entries unchanged.

### Regression Coverage

- `LoanDetail.test.tsx` now proves combined principal and interest balances and overdue counts include the paid pre-revision entry alongside the active schedule.
- `App.test.tsx` now records a payment, creates a later-effective revision, verifies the combined remaining principal, verifies the prepared `VCALENDAR` payload and active version metadata at the calendar boundary, proves a fully paid future entry is excluded from the export, and proves the revision calls only `saveLoanBundle` rather than individual loan/version/entry saves.

### Commands And Results

- `npm test -- --run src/lending/ui/PaymentForm.test.tsx src/lending/ui/PromiseForm.test.tsx src/lending/ui/ScheduleRevisionForm.test.tsx src/lending/ui/LoanDetail.test.tsx src/app/App.test.tsx`: 5 files, 15 tests passed.
- `npm run typecheck`: passed (`tsc --noEmit`).
- `npm test`: 20 files, 107 tests passed.
- `npm run build`: passed; Vite generated the production bundle, PWA manifest, and service worker.

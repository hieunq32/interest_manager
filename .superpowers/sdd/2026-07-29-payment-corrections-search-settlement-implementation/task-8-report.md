# Task 8 Report: Regression, Backup Recovery, and Responsive Verification

## Changes

- Added an App-level correction-to-settlement regression: active payment, correction, voided replacement, replacement payment, settlement on `2026-07-15`, reload, audit visibility, reopening, and a second reload.
- Added encrypted settings-UI recovery coverage: export, visible reset action, restore, and exact borrower, loan, payment-history, adjustment, and lifecycle assertions.
- Added backup-service recovery coverage for adjusted/voided payments and settled/reopened lifecycle records.
- Fixed lifecycle-history read ordering in the repository. IndexedDB records were sorted by random UUID, which made chronological lifecycle history nondeterministic. Reads now sort by `createdAt` with `id` as a stable tie-breaker.

## Verification

- `npm test -- src/app/App.test.tsx src/backup/backupService.test.ts src/lending/storage/lendingRepository.test.ts`
  - Passed: 3 files, 45 tests.
- `npm test`
  - Passed: 30 files, 198 tests.
- `npm run typecheck`
  - Passed.
- `npm run build`
  - Passed. Confirmed `dist/manifest.webmanifest` and `dist/sw.js` exist.
- Mobile/source review:
  - Confirmed the `max-width: 760px` rules stack route headings and make action buttons full width.
  - Confirmed action rows wrap and wide history tables scroll within `.schedule-preview`.
  - Confirmed reviewed icon actions use labeled `Button` controls. No concrete overlap was found, so `src/styles/global.css` was not changed.

## Warning

Independent verification reported this React warning from the new backup recovery test:

```
An update to App inside a test was not wrapped in act(...).
```

The manual hashchange dispatch in that test was subsequently wrapped in `act(...)`. The later local full run passed all 198 tests; this warning is retained here as requested.

## Scope

- No existing assertions were weakened.
- No production CSS changes were needed.

## Fix Round 1

- Strengthened the final post-reopen assertion in `src/app/App.test.tsx`.
- The regression now requires the exact reopened loan record with `status: "active"` and no `settledAt`, exact persisted payment history for the adjusted original, voided replacement, and full payment, exact edit and void adjustment records, and the settlement/reopen lifecycle events in chronological order.
- The end-to-end regression has a 10-second per-test budget because it performs multiple IndexedDB writes, UI mutations, and two App reloads; the focused run completed in 4.6 seconds.
- The existing encrypted backup recovery assertions were preserved unchanged.

### Fix Round 1 Verification

- `npm test -- src/app/App.test.tsx -t "preserves correction, cancellation, settlement, and reopening state across App reloads"`
  - Passed: 1 test; 23 unrelated App tests skipped by the focused filter.
- `npm run typecheck`
  - Passed.

## Whole-Branch Review Fix Wave

### Validation and lifecycle integrity

- Settlement and reopening domain builders now reject blank or malformed `DateOnly` values.
- Payment corrections now require a valid received date and at least one positive principal or interest component.
- The correction and settlement forms show explicit Vietnamese date errors; the existing `Số tiền phải lớn hơn 0` validation is reused for no-op corrections.
- Lifecycle persistence now requires an existing source loan and the exact `active -> settled` or `settled -> active` transition. It also validates `effectiveDate`, `settledAt`, matching settlement dates, cleared `settledAt` on reopen, and a nonblank reopen reason before the atomic batch write.
- Settlement and reopen submissions share a synchronous in-flight guard, and their submit buttons remain disabled until the save completes.
- Added direct lifecycle ordering coverage for equal `createdAt` values using the event ID tie-break.
- Removed the duplicate root `task-7-report.md`; this SDD directory remains the canonical report location.

### TDD and focused verification

- RED: the expanded five-file focused run failed in the expected missing-validation and duplicate-submit cases:
  - 4 lifecycle domain date failures.
  - 3 payment correction domain failures.
  - 8 repository transition/data-integrity failures.
  - 3 payment correction form failures.
  - 2 settlement date form failures.
  - 1 rapid repeated settlement submission failure (`onSettle` was called twice).
- GREEN: `npm test -- src/lending/domain/loanLifecycle.test.ts src/lending/domain/paymentCorrections.test.ts src/lending/storage/lendingRepository.test.ts src/lending/ui/PaymentCorrectionForm.test.tsx src/lending/ui/LoanDetail.test.tsx`
  - Passed: 5 files, 66 tests.
- `npm test -- src/app/App.test.tsx src/backup/backupService.test.ts`
  - Passed: 2 files, 30 tests.
- `npm run typecheck`
  - Passed after the focused implementation.

### Responsive browser verification

- Used the existing cached Playwright `1.62.0-alpha-1783623505000` and cached Chromium `1228`; no package or production dependency was installed.
- Served this worktree with `npm run dev -- --port 4317 --strictPort`. Port `4173` was already serving an unrelated preview from the repository root, so its initial screenshot was discarded and not counted as evidence.
- Captured and visually inspected these real browser states:
  - `task-8-responsive-borrower-list-320.png`: borrower search and status filter at 320px.
  - `task-8-responsive-borrower-detail-360.png`: loan status and collection status filters at 360px.
  - `task-8-responsive-loan-correction-settlement-390.png`: expanded audit history, payment correction form, and eligible settlement form at 390px.
  - `task-8-responsive-loan-reopen-430.png`: settled read-only loan and expanded reopen form at 430px.
- Chromium DOM measurements at every viewport reported:
  - `documentScrollWidth === documentClientWidth` and 0px body-level horizontal overflow.
  - No overlapping visible controls.
  - No unlabeled buttons.
  - No button text exceeding its button width.
- Loan tables at 390px and 430px were wider than the viewport where expected and remained inside `.schedule-preview` horizontal scroll containers. Visual inspection found no incoherent overlap or parent-level text overflow, so no CSS change was made.

### Final required verification

- `npm test`
  - Passed: 30 files, 220 tests.
  - The encrypted backup UI test still emits React `act(...)` warnings while passing. This is the same warning class already documented above; this fix wave did not claim warning-free output.
- `npm run typecheck`
  - Passed.
- `npm run build`
  - Passed: 1,838 modules transformed.
  - Confirmed `dist/manifest.webmanifest` (350 bytes) and `dist/sw.js` (1,223 bytes).
- `git diff --check`
  - Passed with no whitespace errors. Git printed line-ending conversion warnings only.

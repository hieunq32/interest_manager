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

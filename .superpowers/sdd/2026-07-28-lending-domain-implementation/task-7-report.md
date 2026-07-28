# Task 7 Report: Offline Routing, Borrowers, and Loan Onboarding

## Scope Delivered

- Added offline hash routes for dashboard, borrower details, loan details, and settings, including unknown-route fallback and encoded record IDs.
- Replaced the smoke-record landing UI with a borrower dashboard, borrower create/detail/edit flows, and archive-only borrower handling.
- Added multi-loan borrower detail lists and loan-detail route shells.
- Added loan onboarding with integer-VND, date, due-day, rate, reminder, and note validation; percentage inputs are normalized to decimal rates.
- Added exact schedule preview before confirmation. Confirming persists the loan, its first schedule version, and generated entries through `IndexedDbLendingRepository`.
- Kept encrypted export and restore available from the settings hash route.
- Added phone-width responsive styles for lists, forms, actions, and schedule preview overflow.

## TDD Evidence

1. Added route tests first and observed the expected unresolved-module failure before implementing `routes.ts`.
2. Added borrower and loan form tests first and observed the expected unresolved-component failure before implementing the UI components.
3. Added the required-rate regression test; it failed because an empty rate became `0`, then passed after explicit required-rate validation.
4. Updated App tests from the obsolete storage-smoke screen to dashboard, hash reload, encrypted backup/restore, and persisted loan/version/entry behaviors.

## Verification

- Focused UI and routing tests: 3 files, 17 tests passed.
- Full tests: 16 files, 98 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Self-Review

- Hash parsing never delegates to a server router and safely handles malformed encodings by returning the dashboard route.
- Money and schedule calculations stay in domain helpers; React renders the returned schedule data.
- The preview uses the same domain schedule generator as persisted onboarding records.
- No payments, promises, revisions UI, reminder settings UI, or dashboard-polish work was added.

## Concerns

- The existing repository exposes individual save methods, so onboarding writes loan, version, then entries in sequence. A future repository-level transaction API would provide all-or-nothing persistence for storage failures between those calls.

## Fix: Atomic Loan Onboarding

### Changes

- Added `IndexedDbLendingRepository.saveLoanBundle({ loan, version, entries })`.
- The bundle converts all three lending record types and sends them through one `IndexedDbRecordStore.upsertRecords` call, which performs one IndexedDB read-write transaction.
- Updated confirmed loan onboarding to call `saveLoanBundle` once; borrower saves remain independent.
- Added repository coverage for saving and replacing a complete bundle, including the single batch call.
- Updated the App integration test to prove confirmation calls `saveLoanBundle` and does not call the separate loan, version, or entry save methods.

### TDD Evidence

1. Added the repository bundle test first; it failed with `repository.saveLoanBundle is not a function`.
2. Implemented the repository method via `upsertRecords`; the repository suite then passed 4 tests.
3. Strengthened the existing confirmation integration test with bundle-method and no-sequential-save assertions; it failed because the App made no bundle call.
4. Replaced the sequential App writes with one `saveLoanBundle` call; the repository and App suites passed.

### Commands and Output

- `npm test -- src/app/routes.test.ts src/lending/ui/lendingFlow.test.tsx src/lending/storage/lendingRepository.test.ts src/app/App.test.tsx`: 4 files, 21 tests passed.
- `npm run typecheck`: passed.
- `npm test`: 16 files, 99 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

### Concern Resolution

- The sequential-write concern is resolved for initial loan onboarding. The entire loan, first version, and generated entry set now commit in one record-store transaction.

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

# Task 7 Report

Implemented manual loan settlement and reopening workflows.

- Repository lifecycle mutations validate loan/action consistency, persist loan and event atomically, invalidate settled calendar exports, and retain lifecycle history through restore.
- Loan Detail shows settlement eligibility, retains selected past settlement dates, shows lifecycle history, requires a reopening reason, and makes settled loans read-only for payment, promise, revision, reminder, and calendar-export mutations.
- App loads lifecycle events and persists domain-derived settlement and reopening mutations with Vietnamese status messages.

Verification:

- Focused suite: 44/44 tests passed.
- `npm run typecheck` passed.
- `git diff --check` passed.

## Fix Round 1: Close stale mutation forms after settlement

Root cause: settlement status hid mutation buttons but did not clear or gate the existing `entryForm` and `paymentCorrection` state, so a form opened while active remained mounted after the loan rerendered as settled.

Fix: `LoanDetail` clears transient payment, promise, correction, and revision form state when `loan.status` becomes `settled`, and only renders entry/correction forms while the loan is active. The Vietnamese form labels and status copy are unchanged.

Regression coverage: opens a payment form, rerenders the same loan as settled, verifies the save action is removed, and verifies `onSavePayment` was not called.

Verification:

- Focused suite: 45/45 tests passed.
- `npm run typecheck` passed.

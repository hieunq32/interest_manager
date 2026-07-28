# Lending Domain Design

Date: 2026-07-28

## Goal

Add the first lending-domain design for a single personal lender who manages borrowers, loan agreements, scheduled collections, actual payments, payment promises, and iPhone reminders while keeping the app local-first and usable offline.

This document defines the domain behavior before implementation. It does not prescribe React components, database tables, or calculation code yet.

## Product Boundary

The app is a private tool for one lender. It answers these operational questions:

- Who currently owes money?
- Which loans are active?
- What principal and interest are due for each schedule entry?
- Which entries are due soon, due today, partially paid, promised, or overdue?
- What money was actually received, and how was it split between principal and interest?
- What changed when the lender and borrower agreed to a new schedule?
- Which dates should be exported to Apple Calendar for iPhone reminders?

The source of truth is the app's local IndexedDB data. Apple Calendar is an external reminder surface, not the financial ledger.

## Decisions Already Confirmed

### Notification strategy

- Use in-app due and overdue views whenever the app is opened or resumed.
- Export schedule and promise dates to Apple Calendar as `.ics` events.
- Do not add a push-notification backend in this phase.
- Default reminder offset is one day before the due date.
- The default reminder time is configurable in Settings; the initial default is 08:00 local time.
- Each loan can override reminder enabled/disabled state, reminder offset, and reminder time.
- Overdue items are shown in the app but do not create repeating daily notifications.
- A promise-to-pay date can produce a separate calendar reminder.

### Loan calculation models

Each loan chooses one calculation model:

1. `interest-only-final-principal`: collect interest on the schedule and collect principal at the final settlement date.
2. `equal-principal-flat-interest`: divide principal equally across schedule entries and calculate interest on the original principal of the active schedule version.

The MVP does not include equal-total-payment amortization or arbitrary custom schedules as calculation models.

### Calendar dates

- Each loan stores its own monthly due day from 1 through 31.
- A due day that does not exist in a month resolves to the last day of that month.
- The maturity date is an exact calendar date and may differ from the monthly due day.
- The first schedule date is the first occurrence of the configured due day strictly after the disbursement date.
- A monthly schedule is calendar-based. It does not wait for 30 or 31 elapsed days.
- For the installment model, the maturity date replaces the regular due date in the maturity month; it does not create an extra nearby installment.
- For the interest-only model, regular interest entries continue through the regular due dates before maturity, and the maturity entry contains principal plus any final interest period.

### Interest units and partial periods

Each loan stores either `%/month` or `%/day`.

For a monthly rate:

- A regular scheduled period charges one full monthly interest amount, even when the calendar month has 28, 29, 30, or 31 days.
- The first period is charged as one full monthly period when the first due date is reached.
- A non-aligned final period can use either full-period interest or calendar-day proration, selected per loan.
- Calendar-day proration uses the actual days in each calendar month. A period crossing two months is split by month before calculating its interest.

For a daily rate:

- Interest equals the applicable principal base multiplied by the daily rate and the actual number of calendar days in the period.
- The daily-rate calculation is inherently day-based and does not use the monthly partial-period mode.

### Schedule revisions

- A schedule revision is created manually when the agreement changes.
- The old schedule version and its payment history remain immutable for audit purposes.
- The new schedule version applies only from its effective date onward.
- A rate or rate-unit change requires a non-empty adjustment reason.
- A date, maturity, or planned-amount change does not require a reason in the MVP.
- A revision can change principal, dates, rate, rate unit, calculation model, and future planned amounts when agreed by the lender and borrower.
- Existing payment transactions are never recalculated automatically.
- Calendar exports from an older schedule version become stale and must be exported again.

### Payments and promises

- A payment transaction records principal and interest separately.
- One schedule entry can have multiple payment transactions.
- A promise to pay is not a payment and never reduces the outstanding balance.
- A promise stores a promised date, optional promised principal and interest amounts, a note, and its status.
- The original due date remains unchanged when a borrower promises to pay later.
- A payment received after the due date is recorded as late while preserving the actual received date.
- Partial payments do not automatically change future schedule entries. A new agreement requires a manual schedule revision.

## Domain Concepts

### Borrower

A borrower is a person or party who may have one or more loans.

Initial fields:

- `id`
- `displayName`
- `phone` (optional)
- `note` (optional)
- `status`: `active` or `archived`
- `createdAt`
- `updatedAt`

Borrowers with loan history are archived rather than physically deleted.

### Loan

A loan is the top-level agreement and identity for a borrowing relationship.

Initial fields:

- `id`
- `borrowerId`
- `calculationModel`
- `originalPrincipal`
- `disbursementDate`
- `monthlyDueDay`
- `maturityDate`
- `rateValue`
- `rateUnit`: `monthly` or `daily`
- `partialPeriodInterestMode`: `full-period` or `calendar-day-prorated`
- `defaultScheduleVersionId`
- `reminderOverride` (optional)
- `status`: `draft`, `active`, `settled`, `archived`
- `note` (optional)
- `createdAt`
- `updatedAt`

The loan's original agreement values are preserved. Changes are represented by schedule versions instead of overwriting the original agreement.

### Schedule version

A schedule version is a dated set of expected collection entries generated from an agreement.

Initial fields:

- `id`
- `loanId`
- `versionNumber`
- `effectiveDate`
- `calculationModel`
- `principalBase`
- `rateValue`
- `rateUnit`
- `monthlyDueDay`
- `maturityDate`
- `partialPeriodInterestMode`
- `adjustmentReason` (required when rate or rate unit changes)
- `createdAt`

Only one version is current for future calculations. Older versions remain readable.

### Schedule entry

A schedule entry is an expected collection point.

Initial fields:

- `id`
- `scheduleVersionId`
- `dueDate`
- `expectedPrincipal`
- `expectedInterest`
- `status`
- `promiseIds`
- `createdAt`
- `updatedAt`

The entry does not store a mutable final balance. Outstanding values are derived from expected amounts minus payment transactions linked to the entry.

### Payment transaction

A payment transaction is money actually received.

Initial fields:

- `id`
- `loanId`
- `scheduleEntryId` (optional for an unscheduled settlement or adjustment)
- `receivedAt`
- `principalAmount`
- `interestAmount`
- `note` (optional)
- `createdAt`

The MVP does not silently delete payments. Corrections should be represented by an adjustment transaction or a controlled edit flow with audit information.

### Promise to pay

A promise captures a follow-up commitment without treating it as received money.

Initial fields:

- `id`
- `loanId`
- `scheduleEntryId`
- `promisedDate`
- `promisedPrincipal` (optional)
- `promisedInterest` (optional)
- `note`
- `status`: `open`, `fulfilled`, `cancelled`, or `expired`
- `createdAt`
- `updatedAt`

When a payment is recorded, the lender may mark the related promise fulfilled. The promise remains in history.

## Schedule Generation

### Common date rules

1. Validate that maturity is after disbursement.
2. Find the first configured due day strictly after disbursement.
3. Resolve invalid calendar days to the target month's last day.
4. For the installment model, generate regular dates only in months before the maturity month, then add maturity as the final date exactly once. If maturity falls on the regular due day, use that date once.
5. For the interest-only model, generate regular interest dates before maturity, including the regular due date in the maturity month when it is earlier than maturity, then add maturity as the final settlement date.
6. Resolve any invalid regular due day to the last day of its month before comparing it with maturity.

### Interest-only model

For each regular entry, expected principal is zero and expected interest is calculated from the active schedule version's principal base.

The maturity entry includes:

- The remaining principal due for settlement.
- Interest for the final period after the last regular interest entry, using the loan's full-period or calendar-day-prorated setting when needed.

### Equal-principal-flat-interest model

1. Count the generated schedule entries in the active schedule version, including the maturity entry.
2. Divide the version's principal base equally across entries.
3. Put any rounding remainder into the final entry so total expected principal equals the principal base.
4. For a monthly rate, expected interest is the principal base multiplied by the monthly rate for each regular full period.
5. For a daily rate, expected interest uses the principal base, daily rate, and actual period days.
6. The final entry uses the exact maturity date and the selected final-period interest behavior.

## Entry Status Rules

Status is derived from the current date, expected amounts, and received payments:

- `upcoming`: due date is in the future and no payment is due yet.
- `due`: due date is today and outstanding amount remains.
- `promised`: an open promise exists and its promised date is in the future.
- `partially-paid`: some but not all expected principal or interest is received.
- `overdue`: due date has passed and outstanding amount remains.
- `paid`: expected principal and interest are fully received.

If a promise date passes without enough payment, the entry returns to an overdue presentation with the promise recorded as expired. The original due date is always retained.

## Reminder And Calendar Export

The app has global reminder settings and optional loan-level overrides.

Global settings:

- `remindersEnabled`
- `reminderOffsetDays`, default `1`
- `reminderTime`, default `08:00`

Loan overrides can replace any of these values or disable reminders for that loan.

Calendar export creates events for:

- Future schedule entries with outstanding amounts.
- Open promise dates.

Each event should have a stable UID derived from the schedule entry or promise ID and schedule version. A new schedule version creates new event identities. The app must show the export version and warn when the Calendar file is stale.

Calendar export is not the financial source of truth. Payment updates happen in the app and require a new export when future reminders change.

## Main User Workflows

### Create a borrower and loan

1. Create or select a borrower.
2. Create a loan.
3. Select one calculation model.
4. Enter principal, disbursement date, due day, maturity date, rate value, and rate unit.
5. Select final-period interest behavior.
6. Review generated schedule.
7. Save the loan.
8. Export future reminders to Apple Calendar.

### Record a payment

1. Open the loan or due entry.
2. Enter received date.
3. Enter principal and interest separately.
4. Add an optional note.
5. Save the transaction.
6. Recompute outstanding amounts and entry status.

### Record a promise to pay

1. Open an unpaid or partially paid entry.
2. Enter the promised date.
3. Optionally enter promised principal and interest amounts.
4. Add the borrower's explanation or follow-up note.
5. Save the promise.
6. Optionally export the promise reminder to Calendar.

### Revise a schedule

1. Open the current loan schedule.
2. Start a new schedule version.
3. Enter the effective date and new agreed terms.
4. If rate or rate unit changes, require an adjustment reason.
5. Generate and review future entries.
6. Preserve the old version and all previous transactions.
7. Mark the previous Calendar export stale.
8. Export the new future reminders.

## Initial Screens

- Dashboard: totals due soon, due today, overdue, promised follow-ups, and active loans.
- Borrower list: search, active/archive filter, and total outstanding summary.
- Borrower detail: contact information and all loans.
- Loan creation/edit: agreement fields and calculation model.
- Loan detail: current balance, schedule, payments, promises, revisions, and Calendar export state.
- Payment form: separate principal and interest inputs.
- Promise form: promised date, optional amounts, and note.
- Schedule revision form: new terms, effective date, and conditional adjustment reason.
- Settings: global reminder time, default reminder offset, and backup access.

## Data Integrity And Security

- Store VND amounts as integers.
- Store dates as date-only values for schedule dates; do not let browser timezone conversion shift them.
- Store timestamps separately for audit events.
- Never recompute historical entries after a schedule revision.
- Archive rather than delete records with financial history.
- Keep backup encryption and restore behavior from the base source.
- Never include passphrases or raw keys in logs.

## Testing Requirements

The domain implementation should test:

- First due date is the next calendar occurrence after disbursement.
- Due day 31 resolves to month end in short months and leap years.
- Maturity date replaces the final installment date for the installment model.
- Interest-only schedule separates regular interest and final principal settlement.
- Equal principal is divided correctly and rounding is placed in the final entry.
- Monthly flat interest is charged per calendar period, not by elapsed 30-day windows.
- Daily interest uses actual days.
- Final-period full or calendar-day-prorated behavior is correct.
- A rate or rate-unit revision requires a reason.
- Old schedule versions remain unchanged after revision.
- Principal and interest payments aggregate separately.
- Partial payment, promise, fulfilled promise, expired promise, and overdue states are correct.
- Reminder defaults and per-loan overrides generate the expected Calendar event metadata.
- Backup and restore preserve borrowers, loans, schedule versions, entries, payments, promises, and reminder settings.

## Explicitly Out Of Scope

- Web Push or any notification backend.
- Multi-user access or authentication.
- Automatic cloud sync.
- Interest penalties or late fees.
- Equal-total-payment amortization.
- Arbitrary custom schedules as a separate calculation model.
- Borrower messaging through SMS, email, or chat.
- Legal contracts, signatures, or compliance calculations.
- Reports, charts, accounting exports, and tax workflows.
- Native iOS packaging.

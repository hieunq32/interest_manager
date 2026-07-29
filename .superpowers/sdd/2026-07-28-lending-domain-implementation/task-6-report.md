# Task 6 Report: Reminder Settings and Apple Calendar Export

## Scope Delivered

- Added pure reminder-settings resolution with the enabled, one-day, 08:00 default and per-loan enabled/offset/time overrides.
- Added runtime validation for non-negative integer offsets and valid 24-hour HH:MM times.
- Added pure schedule and promise event selection for future outstanding schedule entries and open future promises.
- Added deterministic Apple Calendar ICS serialization with a fixed PRODID, CRLF records, escaped text, UTC DTSTART converted from Asia/Ho_Chi_Minh local time, and per-event VALARM offsets.
- Added stable event UIDs containing the event kind, schedule-version ID, and entry or promise ID.
- Added focused tests for settings resolution, validation, event selection, escaping, CRLF serialization, UTC conversion, deterministic ordering, and disabled reminder exports.

## TDD Evidence

1. Added the requested reminder and ICS tests first, then ran the focused suite. It failed because ./reminderSettings and ./ical did not exist.
2. Implemented the two pure domain modules and reran the focused suite successfully: 13 tests passed.
3. Strengthened the ICS escaping and deterministic-order checks. One assertion initially used literal \\r\\n rather than an actual CRLF terminator; the serializer output showed the production behavior was correct, so the test expectation alone was corrected. The focused suite then passed again.

## Constraint Review

- The reminder modules use no document, browser download API, storage API, or runtime dependency.
- The event selector relies on domain schedule/promise status values: paid entries and non-open promises are excluded.
- The calendar file deliberately has no varying DTSTAMP, and event serialization sorts by date then UID for repeatable output.
- Vietnam's fixed UTC+7 offset is applied directly; no DST logic or timezone package is required.
- UI download helpers, dashboard work, and stale-export UI state were intentionally not implemented because this task's assigned scope is domain-only.

## Verification

- Focused reminder tests: 2 files, 13 tests passed.
- Full tests: 14 files, 82 tests passed.
- Typecheck: passed.
- git diff --check: passed.

## Commit

- feat: export lending reminders to Calendar

## Concerns

- The task brief also lists stale-calendar state, but its assigned constraints explicitly exclude UI/dashboard work. That UI-bound state remains for its owning task.

## Fix Round 1

### Changes

- Removed clock access from event selection. Callers now provide a DateOnly today value, which is validated and used for all future-date filtering.
- Open future promises remain calendar events even when their linked schedule entry is paid. Closed and non-open promise statuses remain excluded.
- CalendarEventInput now carries dtstampUtc. Schedule and promise events derive it from their immutable createdAt values, and each VEVENT emits a validated, formatted UTC DTSTAMP.

### TDD Evidence

1. Added regression expectations for supplied-today filtering, open promises linked to paid entries, deterministic DTSTAMP output, and malformed non-UTC timestamp rejection.
2. Focused tests failed as expected: no DTSTAMP was emitted, event filtering still read the system clock, and paid entries suppressed their open promises.
3. Implemented the minimal pure-data changes and reran the focused suite successfully.

### Commands and Output

- npm test -- src/lending/reminders/reminderSettings.test.ts src/lending/reminders/ical.test.ts: 2 files, 16 tests passed.
- npm run typecheck: passed.
- npm test: 14 files, 85 tests passed.
- git diff --check: passed.

### Commit

- Pending fix commit.

### Follow-up

- Existing generated schedule fixtures may carry date-only createdAt values. Event construction now deterministically normalizes those to midnight UTC before serialization, while complete source timestamps remain strict UTC inputs.
- Added the regression and reran verification: focused reminder tests passed 17 tests, full tests passed 86 tests, typecheck passed, and git diff --check passed.

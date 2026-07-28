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

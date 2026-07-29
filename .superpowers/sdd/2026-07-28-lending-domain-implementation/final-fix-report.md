# Final Lending Review Fix Report

## Changed files

- App/calendar orchestration: `src/app/App.tsx`, `src/app/App.test.tsx`
- Domain validation: `src/lending/domain/revisions.ts`, `src/lending/domain/revisions.test.ts`, `src/lending/domain/scheduleGenerator.ts`, `src/lending/domain/scheduleGenerator.test.ts`
- Persisted Calendar invalidation: `src/lending/storage/lendingRepository.ts`, `src/lending/storage/lendingRepository.test.ts`
- Loan detail and reminders: `src/lending/ui/LoanDetail.tsx`, `src/lending/ui/LoanDetail.test.tsx`, `src/lending/ui/LoanReminderOverrideForm.tsx`, `src/lending/ui/LoanForm.tsx`, `src/lending/ui/lendingFlow.test.tsx`
- Revision form: `src/lending/ui/ScheduleRevisionForm.tsx`, `src/lending/ui/ScheduleRevisionForm.test.tsx`

## Verification

- Focused red run: 15 expected failures reproduced across retained-entry actions, historical Calendar export, invalidation, reminder editing, revision parsing, and date boundaries.
- `npm test -- --run src/lending/domain/revisions.test.ts src/lending/domain/scheduleGenerator.test.ts src/lending/ui/lendingFlow.test.tsx src/lending/ui/ScheduleRevisionForm.test.tsx src/lending/ui/LoanDetail.test.tsx src/lending/storage/lendingRepository.test.ts src/app/App.test.tsx --reporter=dot`: 7 files, 44 tests passed.
- `npm test -- --run`: 22 files, 134 tests passed.
- `npm run typecheck`: passed with no TypeScript errors.
- `npm run build`: passed; 1,833 modules transformed and PWA manifest/service worker generated.
- `git diff --check`: passed.

## Unresolved concerns

None within the scoped Important findings. Runtime restore schema validation and iCalendar line folding remain intentionally outside this fix wave.

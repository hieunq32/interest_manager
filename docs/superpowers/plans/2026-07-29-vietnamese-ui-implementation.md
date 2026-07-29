# Việt hóa giao diện Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Việt hóa toàn bộ nội dung người dùng nhìn thấy trong PWA quản lý tiền lãi mà không thay đổi nghiệp vụ hoặc dữ liệu.

**Architecture:** Tạo một catalog tiếng Việt thuần TypeScript tại `src/i18n/vi.ts` cho nhãn, trạng thái, thông báo và lỗi giao diện. Các component hiện có dùng catalog này hoặc các export tương thích từ `lendingLabels.ts`; mã trạng thái và thông báo lỗi domain nội bộ vẫn giữ nguyên, chỉ được dịch tại biên UI.

**Tech Stack:** Existing Vite, React, TypeScript, Vitest, React Testing Library, IndexedDB, PWA plugin, and lucide-react. No new runtime dependency.

## Global Constraints

- Việt hóa toàn bộ nội dung người dùng nhìn thấy trong PWA quản lý tiền lãi.
- Không thay đổi nghiệp vụ tính lãi, dữ liệu IndexedDB, dữ liệu backup, cấu trúc Calendar hoặc tài liệu kỹ thuật.
- Không Việt hóa tên biến, enum, record type và mã trạng thái nội bộ.
- Không Việt hóa dữ liệu đã lưu trong IndexedDB hoặc backup.
- Không Việt hóa tên file và cấu trúc `.ics`.
- Không Việt hóa `README.md` và tài liệu kỹ thuật.
- Tiền hiển thị theo cách Việt Nam, ví dụ `1.000.000 đ`.
- Ngày nhập liệu giữ định dạng `YYYY-MM-DD`.
- Tên app hiển thị là `Quản lý tiền lãi`.
- Không thêm thư viện i18n để giữ bundle nhỏ, offline-first và không phát sinh chi phí runtime.
- Mọi test UI phải dùng nhãn tiếng Việt mới cho role, label, heading và thông báo.
- `npm test`, `npm run typecheck` và `npm run build` phải đạt sau khi Việt hóa.

---

## File Structure

### Task 1: Add Vietnamese UI Catalog and Shared Formatting

**Files:**
- Create: `src/i18n/vi.ts`
- Create: `src/i18n/vi.test.ts`
- Modify: `src/lending/ui/lendingLabels.ts`

**Interfaces:**

`src/i18n/vi.ts` exports:

```ts
export const vi = {
  appName: "Quản lý tiền lãi",
  navigation: { home: "Trang chủ", settings: "Cài đặt" },
  common: { save: "Lưu", cancel: "Hủy", back: "Quay lại", note: "Ghi chú", actions: "Thao tác", status: "Trạng thái" },
  status: {
    active: "Đang hoạt động", archived: "Đã lưu trữ", settled: "Đã tất toán", draft: "Bản nháp",
    upcoming: "Sắp đến hạn", due: "Đến hạn", promised: "Đã hứa trả", partiallyPaid: "Đã trả một phần",
    overdue: "Quá hạn", paid: "Đã trả đủ", open: "Đang mở", fulfilled: "Đã thực hiện", cancelled: "Đã hủy", expired: "Đã hết hạn",
  },
  borrower: {
    title: "Người vay", new: "Thêm người vay", edit: "Sửa người vay", save: "Lưu người vay",
    archive: "Lưu trữ người vay", displayName: "Tên hiển thị", phone: "Số điện thoại",
    note: "Ghi chú", loans: "Các khoản vay", noBorrowers: "Chưa có người vay nào.",
    noLoans: "Người vay này chưa có khoản vay nào.", notFound: "Không tìm thấy người vay",
  },
  loan: {
    title: "Khoản vay", new: "Thêm khoản vay", details: "Chi tiết khoản vay", notFound: "Không tìm thấy khoản vay",
    principal: "Tiền gốc (đ)", disbursementDate: "Ngày giải ngân", calculationModel: "Mô hình tính",
    monthlyDueDay: "Ngày thu hàng tháng", maturityDate: "Ngày tất toán", rate: "Lãi suất (%)",
    rateUnit: "Đơn vị lãi suất", partialPeriod: "Cách tính lãi kỳ không trọn tháng", note: "Ghi chú",
    preview: "Xem trước lịch thu", confirmSave: "Xác nhận và lưu khoản vay", currentBalance: "Dư nợ hiện tại",
    outstandingPrincipal: "Gốc còn phải thu", outstandingInterest: "Lãi còn phải thu", nextDueDate: "Ngày thu tiếp theo",
    versions: "Các phiên bản lịch thu", active: "đang áp dụng", readOnly: "chỉ xem", originalDue: "Ngày đến hạn gốc",
  },
  payment: {
    record: "Ghi nhận khoản thu", history: "Lịch sử thu tiền", receivedDate: "Ngày thu",
    principalReceived: "Gốc đã thu (đ)", interestReceived: "Lãi đã thu (đ)", scheduleEntry: "Kỳ thu",
    save: "Lưu khoản thu", noPayments: "Chưa có khoản thu nào.", received: "Đã thu", expected: "Dự kiến", outstanding: "Còn phải thu",
  },
  promise: {
    record: "Ghi nhận lời hứa trả", history: "Lịch sử hứa trả", promisedDate: "Ngày hứa trả",
    note: "Ghi chú hứa trả", save: "Lưu lời hứa trả", fulfil: "Đánh dấu đã thực hiện", cancel: "Hủy lời hứa trả",
    noPromises: "Chưa có lời hứa trả nào.", promise: "Lời hứa trả",
  },
  reminder: {
    global: "Nhắc hạn mặc định", loan: "Nhắc hạn riêng khoản vay", useOverride: "Dùng cấu hình nhắc riêng",
    enabled: "Bật nhắc hạn", offsetDays: "Nhắc trước (ngày)", time: "Giờ nhắc", save: "Lưu cài đặt nhắc hạn",
    saveLoan: "Lưu nhắc hạn khoản vay", clearLoan: "Xóa cấu hình nhắc riêng", default: "Cấu hình mặc định",
  },
  calendar: {
    export: "Xuất lịch Calendar", exportHeading: "Xuất lịch Calendar", matches: "Lịch Calendar đang khớp với lịch đang áp dụng.",
    stale: "Lịch Calendar đã cũ. Hãy xuất lại lịch đang áp dụng.", notExported: "Chưa xuất lịch Calendar.",
    markedCurrent: "Đã cập nhật trạng thái lịch Calendar.", preparationFailed: "Không thể chuẩn bị lịch Calendar.",
  },
  backup: {
    title: "Sao lưu", restore: "Khôi phục", reset: "Xóa dữ liệu", backupPassphrase: "Mật khẩu sao lưu",
    restorePassphrase: "Mật khẩu khôi phục", file: "Tệp sao lưu", backup: "Sao lưu", resetLending: "Xóa dữ liệu cho vay",
  },
  errors: {
    displayNameRequired: "Tên hiển thị là bắt buộc", genericBorrowerSave: "Không thể lưu người vay",
    genericLoanSave: "Không thể lưu khoản vay", genericPaymentSave: "Không thể lưu khoản thu",
    genericPromiseSave: "Không thể lưu lời hứa trả", genericReminderSave: "Không thể lưu cài đặt nhắc hạn",
    genericRevisionSave: "Không thể lưu phiên bản lịch", previewFailed: "Không thể xem trước lịch thu",
    requiredDate: "Vui lòng nhập ngày bắt buộc", positiveAmount: "Số tiền phải lớn hơn 0",
    requiredPromiseNote: "Ghi chú hứa trả là bắt buộc", requiredReason: "Vui lòng nhập lý do điều chỉnh",
    invalidReminderOffset: "Số ngày nhắc trước phải là số nguyên không âm", invalidReminderTime: "Giờ nhắc phải có dạng HH:MM",
    backupPassphraseRequired: "Vui lòng nhập mật khẩu sao lưu", restorePassphraseRequired: "Vui lòng nhập mật khẩu khôi phục",
    calendarPreparationFailed: "Không thể chuẩn bị lịch Calendar.", unknown: "Đã xảy ra lỗi. Vui lòng thử lại.",
  },
} as const;

export function translateError(error: unknown, fallback: string): string;
```

The catalog must contain the exact Vietnamese copy consumed by later tasks for navigation, borrower/loan/payment/promise/reminder/calendar/backup screens, empty states, validation messages, and app operation messages. `translateError` maps known English domain/UI messages, including dynamic messages beginning with `Principal`, `Monthly due day`, `Invalid date-only value`, and `effectiveDate`, to Vietnamese while returning the supplied Vietnamese fallback for unknown errors.

Update `lendingLabels.ts` so `calculationModelLabels`, `rateUnitLabels`, and `partialPeriodInterestModeLabels` return Vietnamese labels. Change `formatMoneyVnd` to use `Intl.NumberFormat("vi-VN")` and append `" đ"`; do not change the numeric value or persisted money type.

- [ ] **Step 1: Write failing catalog and formatting tests.**

Add tests asserting the app name, status/model/rate labels, at least one translated validation message, and:

```ts
expect(formatMoneyVnd(1_000_000)).toBe("1.000.000 đ");
expect(formatMoneyVnd(0)).toBe("0 đ");
```

- [ ] **Step 2: Run focused tests and verify they fail.**

Run `npm test -- src/i18n/vi.test.ts`; expected failure because the catalog and Vietnamese formatter do not exist yet.

- [ ] **Step 3: Implement the catalog and shared labels.**

Keep the catalog as static data and small pure helper functions. Do not add locale state, language switching, persistence changes, or a translation dependency.

- [ ] **Step 4: Run focused tests and typecheck.**

Run `npm test -- src/i18n/vi.test.ts` and `npm run typecheck`; both must pass.

- [ ] **Step 5: Commit.**

Run:

```bash
git add src/i18n/vi.ts src/i18n/vi.test.ts src/lending/ui/lendingLabels.ts
git commit -m "feat: add Vietnamese UI catalog"
```

### Task 2: Translate App Shell, Dashboard, and Borrower Screens

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/lending/ui/Dashboard.tsx`
- Modify: `src/lending/ui/Dashboard.test.tsx`
- Modify: `src/lending/ui/BorrowerList.tsx`
- Modify: `src/lending/ui/BorrowerDetail.tsx`
- Modify: `src/lending/ui/BorrowerForm.tsx`
- Modify: `src/lending/ui/lendingFlow.test.tsx`

**Interfaces:** Consume the `vi` catalog, `translateError`, and Vietnamese exports from Task 1. Do not change route names, domain values, callback signatures, or persistence calls.

Use these user-visible translations consistently:

```ts
"Dashboard" -> "Tổng quan"
"Borrowers" -> "Người vay"
"New borrower" -> "Thêm người vay"
"Edit borrower" -> "Sửa người vay"
"New loan" -> "Thêm khoản vay"
"Save borrower" -> "Lưu người vay"
"Archive borrower" -> "Lưu trữ người vay"
"No borrowers yet." -> "Chưa có người vay nào."
"No loans for this borrower." -> "Người vay này chưa có khoản vay nào."
"Due today" -> "Đến hạn hôm nay"
"Upcoming" -> "Sắp đến hạn"
"Promises" -> "Đã hứa trả"
"Overdue" -> "Quá hạn"
"Open loan" -> "Mở khoản vay"
"Home" -> "Trang chủ"
"Settings" -> "Cài đặt"
"Online" / "Offline" -> "Đang online" / "Đang offline"
```

Translate borrower statuses and empty/error messages through the catalog. Keep borrower names, phone numbers, dates, IDs, and internal status values unchanged. The app shell H1 must render `vi.appName`.

- [ ] **Step 1: Update UI tests to assert Vietnamese names.**

Change dashboard and borrower-flow queries to Vietnamese labels and add an assertion that the shell renders `Quản lý tiền lãi`, `Trang chủ`, and `Cài đặt`.

- [ ] **Step 2: Run focused UI tests and verify failures.**

Run `npm test -- src/lending/ui/Dashboard.test.tsx src/lending/ui/lendingFlow.test.tsx src/app/App.test.tsx`; expected failures identify remaining English labels.

- [ ] **Step 3: Translate the shell and borrower/dashboard components.**

Use catalog values instead of repeating literal translations. Preserve icon buttons, route behavior, status tones, and layout.

- [ ] **Step 4: Run focused UI tests and typecheck.**

Run the focused command from Step 2 and `npm run typecheck`; all must pass.

- [ ] **Step 5: Commit.**

Run `git add src/app/App.tsx src/lending/ui/Dashboard.tsx src/lending/ui/Dashboard.test.tsx src/lending/ui/BorrowerList.tsx src/lending/ui/BorrowerDetail.tsx src/lending/ui/BorrowerForm.tsx src/lending/ui/lendingFlow.test.tsx && git commit -m "feat: translate dashboard and borrower screens"`.

### Task 3: Translate Loan, Payment, Promise, Reminder, and Revision Forms

**Files:**
- Modify: `src/lending/ui/LoanForm.tsx`
- Modify: `src/lending/ui/PaymentForm.tsx`
- Modify: `src/lending/ui/PaymentForm.test.tsx`
- Modify: `src/lending/ui/PromiseForm.tsx`
- Modify: `src/lending/ui/PromiseForm.test.tsx`
- Modify: `src/lending/ui/LoanReminderOverrideForm.tsx`
- Modify: `src/lending/ui/ReminderSettings.tsx`
- Modify: `src/lending/ui/ReminderSettings.test.tsx`
- Modify: `src/lending/ui/ScheduleRevisionForm.tsx`
- Modify: `src/lending/ui/ScheduleRevisionForm.test.tsx`
- Modify: `src/lending/ui/lendingFlow.test.tsx`

**Interfaces:** Consume the Task 1 catalog and `translateError`; keep all form state keys and callback payloads unchanged.

Use Vietnamese labels such as:

```ts
"Principal (VND)" -> "Tiền gốc (đ)"
"Disbursement date" -> "Ngày giải ngân"
"Calculation model" -> "Mô hình tính"
"Monthly due day" -> "Ngày thu hàng tháng"
"Maturity date" -> "Ngày tất toán"
"Rate (%)" -> "Lãi suất (%)"
"Rate unit" -> "Đơn vị lãi suất"
"Partial-period interest" -> "Cách tính lãi kỳ không trọn tháng"
"Use reminder override" -> "Dùng cấu hình nhắc riêng"
"Preview schedule" -> "Xem trước lịch thu"
"Confirm and save loan" -> "Xác nhận và lưu khoản vay"
"Principal received (VND)" -> "Gốc đã thu (đ)"
"Interest received (VND)" -> "Lãi đã thu (đ)"
"Save payment" -> "Lưu khoản thu"
"Promised date" -> "Ngày hứa trả"
"Promise note" -> "Ghi chú hứa trả"
"Save promise" -> "Lưu lời hứa trả"
"Global reminders" -> "Nhắc hạn mặc định"
"Save reminder settings" -> "Lưu cài đặt nhắc hạn"
"Save revision" -> "Lưu phiên bản lịch mới"
```

Translate validation errors at the UI boundary, including required dates, positive amounts, invalid time/offset, missing adjustment reason, and generic save/preview failures. The displayed currency must use `đ` through `formatMoneyVnd`; input labels may mention `đ` but form payloads remain integer VND.

- [ ] **Step 1: Update form tests to query Vietnamese labels and assert Vietnamese errors.**

Cover at least one validation error per form and preserve existing payload assertions for normalized rates, amounts, dates, reminder overrides, and revision reasons.

- [ ] **Step 2: Run focused form tests and verify failures.**

Run `npm test -- src/lending/ui/PaymentForm.test.tsx src/lending/ui/PromiseForm.test.tsx src/lending/ui/ReminderSettings.test.tsx src/lending/ui/ScheduleRevisionForm.test.tsx src/lending/ui/lendingFlow.test.tsx`; expected failures identify untranslated labels.

- [ ] **Step 3: Translate form labels, option labels, buttons, and errors.**

Use the shared catalog. Do not alter parsing, validation conditions, IDs generated from labels, or callback values.

- [ ] **Step 4: Run focused tests and typecheck.**

Run the focused command from Step 2 and `npm run typecheck`; all must pass.

- [ ] **Step 5: Commit.**

Run `git add src/lending/ui/LoanForm.tsx src/lending/ui/PaymentForm.tsx src/lending/ui/PaymentForm.test.tsx src/lending/ui/PromiseForm.tsx src/lending/ui/PromiseForm.test.tsx src/lending/ui/LoanReminderOverrideForm.tsx src/lending/ui/ReminderSettings.tsx src/lending/ui/ReminderSettings.test.tsx src/lending/ui/ScheduleRevisionForm.tsx src/lending/ui/ScheduleRevisionForm.test.tsx src/lending/ui/lendingFlow.test.tsx && git commit -m "feat: translate lending forms"`.

### Task 4: Translate Loan Detail and Operational Messages

**Files:**
- Modify: `src/lending/ui/LoanDetail.tsx`
- Modify: `src/lending/ui/LoanDetail.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:** Consume the same Task 1 catalog. The `App` callbacks, route types, repository methods, and `PreparedCalendarExport` shape remain unchanged.

Translate the loan detail sections and table headings:

```ts
"Loan details" -> "Chi tiết khoản vay"
"Current balance" -> "Dư nợ hiện tại"
"Outstanding principal" -> "Gốc còn phải thu"
"Outstanding interest" -> "Lãi còn phải thu"
"Next due date" -> "Ngày thu tiếp theo"
"Schedule versions" -> "Các phiên bản lịch thu"
"read-only" -> "chỉ xem"
"active" -> "đang áp dụng"
"Record payment" -> "Ghi nhận khoản thu"
"Record promise" -> "Ghi nhận lời hứa trả"
"Payment history" -> "Lịch sử thu tiền"
"Promise history" -> "Lịch sử hứa trả"
"Fulfil promise" -> "Đánh dấu đã thực hiện"
"Cancel promise" -> "Hủy lời hứa trả"
"Calendar export" -> "Xuất lịch Calendar"
"Calendar export is stale. Re-export the active schedule." -> "Lịch Calendar đã cũ. Hãy xuất lại lịch đang áp dụng."
```

Translate App messages and Settings operation panels:

```ts
"Backup" -> "Sao lưu"
"Restore" -> "Khôi phục"
"Reset" -> "Xóa dữ liệu"
"Reset lending data" -> "Xóa dữ liệu cho vay"
"Backup passphrase" -> "Mật khẩu sao lưu"
"Restore passphrase" -> "Mật khẩu khôi phục"
"Backup file" -> "Tệp sao lưu"
```

Map all save/export/restore/reset/not-found messages through the catalog. Do not translate backup JSON, passphrase handling, Calendar content, route hashes, or internal error codes. Update App and LoanDetail tests to assert the Vietnamese visible text while preserving all financial, routing, backup, and export behavior.

- [ ] **Step 1: Update App and LoanDetail tests for Vietnamese visible output.**

Keep existing assertions for persisted records, Calendar content, backup replacement, reset scope, and route changes. Change only visible labels/messages queried by the tests.

- [ ] **Step 2: Run focused App and LoanDetail tests and verify failures.**

Run `npm test -- src/app/App.test.tsx src/lending/ui/LoanDetail.test.tsx`; expected failures identify the remaining English copy.

- [ ] **Step 3: Translate detail tables, operation panels, and App messages.**

Use the catalog and retain the existing derived status labels, date logic, Calendar export, backup encryption, restore confirmation, and offline indicator behavior.

- [ ] **Step 4: Run focused tests and typecheck.**

Run the focused command from Step 2 and `npm run typecheck`; all must pass.

- [ ] **Step 5: Commit.**

Run `git add src/lending/ui/LoanDetail.tsx src/lending/ui/LoanDetail.test.tsx src/app/App.tsx src/app/App.test.tsx && git commit -m "feat: translate loan detail and app messages"`.

### Task 5: Audit Visible Copy and Run Full Verification

**Files:**
- Modify: any remaining `src/**/*.tsx` or `src/i18n/vi.ts` files found by the audit
- Modify: corresponding tests for any remaining visible copy

**Interfaces:** All previous tasks are complete. The audit must not modify domain data, repository interfaces, backup formats, Calendar serialization, or README/documentation.

- [ ] **Step 1: Scan for remaining user-visible English.**

Run:

```bash
rg -n "Borrower|Loan|Payment|Promise|Calendar|Settings|Backup|Restore|Reset|Save|Cancel|Required|Could not|Online|Offline|Current|Outstanding|Version|Due|Read-only|None|New|Edit|Archive|Status|Home|Dashboard|Reminder|Schedule|Record" src --glob "*.tsx" --glob "*.ts"
```

Review every match and distinguish internal identifiers, imports, test descriptions, and domain errors from text rendered to the user. Any rendered English string must move to the Vietnamese catalog or be replaced by a Vietnamese literal in the catalog consumer.

- [ ] **Step 2: Run the full automated suite.**

Run `npm test`; expected result is all test files and tests passing with no untranslated UI assertion failures.

- [ ] **Step 3: Run static checks and production build.**

Run `npm run typecheck`, `npm run build`, and `git diff --check`; all must pass. Confirm `dist/manifest.webmanifest`, `dist/sw.js`, and the generated app assets exist.

- [ ] **Step 4: Verify the running PWA.**

Start the dev server on an unused port, open the dashboard at a phone-sized viewport, and verify the visible shell, dashboard, borrower form, loan form, loan detail, settings, backup/restore panels, and offline status are Vietnamese. Verify HTTP 200 for `/`, `/manifest.webmanifest`, and `/sw.js`.

- [ ] **Step 5: Commit any final audit fixes.**

If the audit found and fixed a remaining rendered English string, commit it with `fix: complete Vietnamese UI copy`; otherwise leave the implementation commits unchanged.

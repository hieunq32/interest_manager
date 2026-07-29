# Sửa giao dịch, tìm kiếm và tất toán - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung sửa/hủy giao dịch có lịch sử, tìm kiếm/lọc người vay và khoản vay, cùng tất toán/mở lại khoản vay cho app quản lý cho vay local-first.

**Architecture:** Giữ IndexedDB là nguồn dữ liệu gốc. Payment correction tạo mutation bất biến gồm giao dịch cũ, giao dịch thay thế và bản ghi audit; ledger chỉ tính payment đang hiệu lực. Các quy tắc correction, settlement, trạng thái và lọc nằm trong module domain thuần TypeScript, còn React chỉ điều phối form, hiển thị và gọi repository.

**Tech Stack:** Vite, React, TypeScript, Vitest, React Testing Library, IndexedDB qua `idb`/record store hiện có, Web Crypto backup hiện có và `lucide-react`. Không thêm runtime dependency.

## Global Constraints

- Mọi nội dung hiển thị mới trong app phải bằng tiếng Việt; enum, tên file và khóa dữ liệu nội bộ có thể giữ tiếng Anh.
- IndexedDB là nguồn sự thật; mọi luồng chính phải dùng được offline.
- Tiền VND lưu bằng số nguyên an toàn; ngày nghiệp vụ dùng `YYYY-MM-DD`; timestamp audit dùng ISO string.
- Không xóa vật lý giao dịch có lịch sử; giao dịch `adjusted` hoặc `voided` không được tính vào ledger.
- Sửa/hủy giao dịch luôn bắt buộc lý do; không được đổi `loanId` hoặc `scheduleEntryId` trong correction flow.
- Tất toán chỉ được xác nhận thủ công khi gốc và lãi còn phải thu đều bằng `0`.
- Mở lại khoản vay đã tất toán luôn bắt buộc lý do.
- Backup phải giữ cả dữ liệu đang hiệu lực và lịch sử điều chỉnh/vòng đời.
- Viết test trước production code, chạy test đỏ trước khi triển khai tối thiểu, rồi chạy test xanh và toàn bộ suite sau mỗi task.
- Mỗi task được giao cho một subagent mới, phải tự kiểm tra và commit; sau đó task reviewer kiểm tra spec và chất lượng trước khi sang task tiếp theo.
- Không sửa các thay đổi không liên quan trong working tree; không dùng lệnh phá hủy git.

## File Map

### Domain

- Modify `src/lending/domain/types.ts`: trạng thái payment, audit record, lifecycle event và `settledAt`.
- Create `src/lending/domain/paymentCorrections.ts`: normalize payment, validate correction/cancellation và tạo mutation thuần.
- Create `src/lending/domain/paymentCorrections.test.ts`: test đỏ/xanh cho correction.
- Modify `src/lending/domain/ledger.ts`: chỉ tính payment hiệu lực và tổng hợp số dư sau điều chỉnh.
- Modify `src/lending/domain/ledger.test.ts`: regression tests cho payment cũ, adjusted và voided.
- Create `src/lending/domain/loanSelectors.ts`: trạng thái thu tiền cấp khoản vay và selector tìm kiếm/lọc.
- Create `src/lending/domain/loanSelectors.test.ts`: test search/filter/status priority.
- Create `src/lending/domain/loanLifecycle.ts`: eligibility, settle và reopen.
- Create `src/lending/domain/loanLifecycle.test.ts`: test điều kiện và lifecycle mutation.

### Storage

- Modify `src/lending/storage/recordTypes.ts`: đăng ký `payment-adjustment` và `loan-lifecycle-event`.
- Modify `src/lending/storage/lendingRepository.ts`: đọc payment hiệu lực/lịch sử và ghi mutation theo batch.
- Modify `src/lending/storage/lendingRepository.test.ts`: round-trip, legacy normalization, correction, cancellation và lifecycle.
- Modify `src/backup/backupService.test.ts`: backup/restore giữ các record mới.

### UI và App

- Modify `src/i18n/vi.ts`: nhãn, lỗi, trạng thái và thông báo mới bằng tiếng Việt.
- Modify `src/lending/ui/lendingLabels.ts`: nhãn collection status và payment status.
- Modify `src/lending/ui/BorrowerList.tsx`: ô tìm kiếm và bộ lọc trạng thái người vay.
- Modify `src/lending/ui/BorrowerDetail.tsx`: bộ lọc khoản vay và trạng thái thu tiền.
- Create `src/lending/ui/PaymentCorrectionForm.tsx`: form sửa/hủy giao dịch với lý do bắt buộc.
- Create `src/lending/ui/PaymentCorrectionForm.test.tsx`: test validation và payload.
- Modify `src/lending/ui/LoanDetail.tsx`: lịch sử điều chỉnh, thao tác sửa/hủy, khóa thao tác khi tất toán và khu vực settlement.
- Modify `src/lending/ui/LoanDetail.test.tsx`: test các luồng hiển thị và thao tác.
- Modify `src/app/App.tsx`: state lịch sử, handlers correction/lifecycle, selector props và refresh dữ liệu.
- Modify `src/app/App.test.tsx`: test integration cho lưu, điều chỉnh, lọc và tất toán.
- Modify `src/styles/global.css`: layout cho form, bảng lịch sử và filter ở kích thước iPhone nếu cần.

## Checkpoint Sau Mỗi Task

Sau mỗi task, implementer phải:

1. Chạy test riêng của task và ghi lại output.
2. Chạy `npm test`, `npm run typecheck` nếu task chạm TypeScript public API.
3. Chạy `git diff --check`.
4. Tự review diff, commit đúng phạm vi task.
5. Controller tạo review package và dispatch task reviewer kiểm tra spec compliance + code quality.
6. Chỉ khi reviewer không còn Critical/Important finding mới ghi task hoàn thành trong SDD ledger.

## Task 1: Mô hình payment correction và audit mutation

**Files:**
- Modify: `src/lending/domain/types.ts`
- Create: `src/lending/domain/paymentCorrections.ts`
- Test: `src/lending/domain/paymentCorrections.test.ts`

**Interfaces:**

```ts
export type PaymentStatus = "active" | "adjusted" | "voided";

export interface PaymentSnapshot {
  scheduleEntryId?: string;
  receivedAt: DateOnly;
  principalAmount: MoneyVnd;
  interestAmount: MoneyVnd;
  note?: string;
}

export interface PaymentAdjustment {
  id: string;
  loanId: string;
  paymentId: string;
  replacementPaymentId?: string;
  action: "edit" | "void";
  reason: string;
  before: PaymentSnapshot;
  after?: PaymentSnapshot;
  createdAt: string;
}

export interface PaymentCorrectionMutation {
  original: PaymentTransaction;
  replacement: PaymentTransaction;
  adjustment: PaymentAdjustment;
}

export interface PaymentCancellationMutation {
  original: PaymentTransaction;
  adjustment: PaymentAdjustment;
}

export interface LoanLifecycleEvent {
  id: string;
  loanId: string;
  action: "settled" | "reopened";
  effectiveDate: DateOnly;
  reason?: string;
  createdAt: string;
}

export function normalizePayment(value: PaymentTransaction): PaymentTransaction;
export function buildPaymentCorrection(input: {
  payment: PaymentTransaction;
  next: PaymentSnapshot;
  reason: string;
  adjustmentId: string;
  replacementId: string;
  now: string;
}): PaymentCorrectionMutation;
export function buildPaymentCancellation(input: {
  payment: PaymentTransaction;
  reason: string;
  adjustmentId: string;
  now: string;
}): PaymentCancellationMutation;
```

- [ ] **Step 1: Viết test đỏ cho normalize payment cũ**

```ts
it("treats a legacy payment without status as active", () => {
  expect(normalizePayment(legacyPayment)).toMatchObject({
    status: "active",
    updatedAt: legacyPayment.createdAt,
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại đúng nguyên nhân**

Run: `npm test -- src/lending/domain/paymentCorrections.test.ts`

Expected: FAIL vì `normalizePayment` chưa tồn tại hoặc chưa thêm trường trạng thái.

- [ ] **Step 3: Viết test đỏ cho edit/cancel mutation**

Test phải xác nhận edit giữ nguyên `loanId`/`scheduleEntryId`, đổi trạng thái gốc thành `adjusted`, tạo replacement `active`, giữ before/after và lý do. Test cancellation phải xác nhận gốc thành `voided`, không có replacement. Thêm test từ chối lý do rỗng và snapshot có số tiền âm/không nguyên.

- [ ] **Step 4: Implement tối thiểu**

Thêm `status?: PaymentStatus` và `updatedAt?: string` theo hướng tương thích backup cũ. `normalizePayment` trả về payment với status mặc định `active`. `buildPaymentCorrection` phải ném lỗi nếu payment không active, lý do sau `trim()` rỗng, `next.scheduleEntryId` khác liên kết cũ, hoặc số tiền không hợp lệ. Payment replacement dùng `replacementId`, `createdAt: now`, `updatedAt: now` và cùng `loanId`/schedule link.

- [ ] **Step 5: Chạy test xanh và regression**

Run: `npm test -- src/lending/domain/paymentCorrections.test.ts src/lending/domain/ledger.test.ts`

Expected: test mới pass; test ledger hiện có không bị thay đổi hành vi.

- [ ] **Step 6: Commit**

```powershell
git add src/lending/domain/types.ts src/lending/domain/paymentCorrections.ts src/lending/domain/paymentCorrections.test.ts
git commit -m "feat: add auditable payment correction mutations"
```

**Acceptance:** Domain có thể tạo mutation sửa/hủy không mất dữ liệu, tương thích payment cũ và có validation lý do/liên kết/số tiền.

## Task 2: Ledger hiệu lực và selector tìm kiếm/lọc

**Files:**
- Modify: `src/lending/domain/ledger.ts`
- Modify: `src/lending/domain/ledger.test.ts`
- Create: `src/lending/domain/loanSelectors.ts`
- Test: `src/lending/domain/loanSelectors.test.ts`

**Interfaces:**

```ts
export type LoanCollectionStatus = "upcoming" | "due" | "promised" | "overdue" | "paid";

export interface LoanFilter {
  borrowerId?: string;
  loanStatuses?: LoanStatus[];
  collectionStatuses?: LoanCollectionStatus[];
}

export interface LoanCollectionContext {
  loan: Loan;
  entries: ScheduleEntry[];
  payments: PaymentTransaction[];
  promises: PromiseToPay[];
  today: DateOnly;
}

export function getLoanCollectionStatus(input: LoanCollectionContext): LoanCollectionStatus;
export function filterBorrowers(input: {
  borrowers: Borrower[];
  query: string;
  status: "all" | "active" | "archived";
}): Borrower[];
export function filterLoans(input: {
  contexts: LoanCollectionContext[];
  filter: LoanFilter;
}): Loan[];
```

- [ ] **Step 1: Viết test đỏ cho ledger bỏ qua payment không hiệu lực**

```ts
it("excludes adjusted and voided payments from entry totals", () => {
  expect(calculateEntryTotals(entry(), [
    payment({ principalAmount: 1_000, interestAmount: 100, status: "adjusted" }),
    payment({ id: "voided", principalAmount: 1_000, interestAmount: 100, status: "voided" }),
  ])).toEqual({
    receivedPrincipal: 0,
    receivedInterest: 0,
    outstandingPrincipal: 1_000,
    outstandingInterest: 100,
  });
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- src/lending/domain/ledger.test.ts`

Expected: FAIL vì ledger hiện cộng mọi payment.

- [ ] **Step 3: Viết test đỏ cho collection status và search/filter**

Bao phủ các ưu tiên: overdue > due/partial > promised > paid > upcoming; tìm tên có dấu bằng query không dấu; tìm số điện thoại; lọc borrower active/archived; lọc loan theo borrower, status và collection status. Dùng `today` truyền vào fixture, không dùng ngày hệ thống trong selector.

- [ ] **Step 4: Implement ledger và selector**

Trong `calculateEntryTotals`, dùng `normalizePayment` hoặc helper `isActivePayment`. Không thay đổi phép tính overpayment hiện có. `getLoanCollectionStatus` phải dựa trên các entry hiện tại và trạng thái entry đã tính. Collection `paid` nghĩa là các kỳ đã đến hạn đều đã thu đủ nhưng khoản vay vẫn còn kỳ tương lai; nếu chưa có kỳ đến hạn thì là `upcoming`.

Tìm kiếm borrower phải lowercase, bỏ dấu tiếng Việt và chuẩn hóa khoảng trắng/số điện thoại. Selector không mutate input và giữ thứ tự ban đầu.

- [ ] **Step 5: Chạy test xanh và toàn bộ domain suite**

Run: `npm test -- src/lending/domain/ledger.test.ts src/lending/domain/loanSelectors.test.ts`

Expected: test mới và toàn bộ test ledger pass.

- [ ] **Step 6: Commit**

```powershell
git add src/lending/domain/ledger.ts src/lending/domain/ledger.test.ts src/lending/domain/loanSelectors.ts src/lending/domain/loanSelectors.test.ts
git commit -m "feat: derive effective loan collection filters"
```

**Acceptance:** Ledger không tính giao dịch lịch sử; selector trả đúng kết quả tìm kiếm/lọc và trạng thái khoản vay theo ngày được truyền vào.

## Task 3: Typed persistence, atomic correction và backup record types

**Files:**
- Modify: `src/lending/storage/recordTypes.ts`
- Modify: `src/lending/storage/lendingRepository.ts`
- Modify: `src/lending/storage/lendingRepository.test.ts`
- Modify: `src/backup/backupService.test.ts`

**Interfaces:**

```ts
export interface LendingRepository {
  listPayments(loanId?: string): Promise<PaymentTransaction[]>; // active only
  listPaymentHistory(loanId?: string): Promise<PaymentTransaction[]>; // all states
  listPaymentAdjustments(loanId?: string): Promise<PaymentAdjustment[]>;
  savePaymentCorrection(value: PaymentCorrectionMutation): Promise<void>;
  savePaymentCancellation(value: PaymentCancellationMutation): Promise<void>;
  listLoanLifecycleEvents(loanId?: string): Promise<LoanLifecycleEvent[]>;
  saveLoanLifecycleMutation(value: { loan: Loan; event: LoanLifecycleEvent }): Promise<void>;
}
```

- [ ] **Step 1: Viết test đỏ cho record types và legacy payment**

Thêm fixture `lending.payment-adjustment` và `lending.loan-lifecycle-event`, assert `isLendingRecordType` nhận hai type mới. Lưu một GenericRecord payment không có status, gọi `listPayments`, và assert kết quả được normalize thành active.

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- src/lending/storage/lendingRepository.test.ts`

Expected: FAIL vì record type và repository methods chưa tồn tại.

- [ ] **Step 3: Viết test đỏ cho atomic correction/cancellation**

Test `savePaymentCorrection` phải kiểm tra:

```ts
await repository.savePaymentCorrection(mutation);
await expect(repository.listPayments(loan.id)).resolves.toEqual([mutation.replacement]);
await expect(repository.listPaymentHistory(loan.id)).resolves.toEqual([mutation.original, mutation.replacement]);
await expect(repository.listPaymentAdjustments(loan.id)).resolves.toEqual([mutation.adjustment]);
```

Test cancellation phải chỉ còn payment active khác, nhưng history vẫn chứa payment voided. Nếu loan đã có `calendarExportVersionId`, correction/cancellation phải làm stale export.

- [ ] **Step 4: Implement typed records và batch writes**

Đăng ký hai record type trong `LENDING_RECORD_TYPES` và `LendingRecordData`. `listPayments` normalize rồi lọc status `active`; `listPaymentHistory` normalize tất cả. `savePaymentCorrection` ghi original updated status, replacement và adjustment trong một `upsertRecords` batch, đồng thời invalidate calendar export nếu cần. Cancellation ghi original + adjustment theo cùng quy tắc.

Không để repository tự tạo replacement hay thay đổi số tiền; repository chỉ persist mutation đã được domain validate.

- [ ] **Step 5: Viết và chạy backup round-trip test**

Tạo repository chứa borrower, loan, payment gốc đã adjusted, payment replacement, adjustment record và lifecycle record. Gọi `listAllDomainRecords`, encrypt bằng `createEncryptedBackup`, restore bằng `restoreEncryptedBackup`, rồi assert toàn bộ record mới vẫn còn nguyên type/data.

Run: `npm test -- src/lending/storage/lendingRepository.test.ts src/backup/backupService.test.ts`

Expected: PASS, không log passphrase hoặc payload giải mã.

- [ ] **Step 6: Commit**

```powershell
git add src/lending/storage/recordTypes.ts src/lending/storage/lendingRepository.ts src/lending/storage/lendingRepository.test.ts src/backup/backupService.test.ts
git commit -m "feat: persist payment audit records"
```

**Acceptance:** Correction, cancellation, legacy normalization và backup/restore hoạt động qua repository; các mutation được ghi theo batch và lịch Calendar bị stale khi dữ liệu thu thay đổi.

## Task 4: Domain lifecycle cho tất toán và mở lại

**Files:**
- Modify: `src/lending/domain/types.ts`
- Create: `src/lending/domain/loanLifecycle.ts`
- Test: `src/lending/domain/loanLifecycle.test.ts`

**Interfaces:**

`LoanLifecycleEvent` is defined in Task 1 and imported here. The lifecycle domain exposes:

```ts
export interface SettlementEligibility {
  eligible: boolean;
  outstandingPrincipal: MoneyVnd;
  outstandingInterest: MoneyVnd;
}

export function evaluateSettlementEligibility(summary: LoanSummary): SettlementEligibility;
export function settleLoan(input: {
  loan: Loan;
  summary: LoanSummary;
  settlementDate: DateOnly;
  eventId: string;
  now: string;
}): { loan: Loan; event: LoanLifecycleEvent };
export function reopenLoan(input: {
  loan: Loan;
  reason: string;
  eventId: string;
  effectiveDate: DateOnly;
  now: string;
}): { loan: Loan; event: LoanLifecycleEvent };
```

- [ ] **Step 1: Viết test đỏ cho eligibility**

```ts
it("allows settlement only when both component balances are zero", () => {
  expect(evaluateSettlementEligibility(summary({ outstandingPrincipal: 0, outstandingInterest: 0 }))).toEqual({
    eligible: true,
    outstandingPrincipal: 0,
    outstandingInterest: 0,
  });
});
```

Thêm test false khi chỉ còn gốc hoặc chỉ còn lãi, và test không tự đổi loan status khi chỉ gọi eligibility.

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- src/lending/domain/loanLifecycle.test.ts`

Expected: FAIL vì module lifecycle chưa tồn tại.

- [ ] **Step 3: Viết test đỏ cho settle/reopen**

Assert settle chuyển loan `active` thành `settled`, lưu đúng ngày quá khứ đã nhập, đặt `settledAt`, tạo event `settled`, và từ chối loan đã settled/archived hoặc summary chưa đủ. Assert reopen yêu cầu reason khác whitespace, chuyển về active, xóa `settledAt`, tạo event `reopened`.

- [ ] **Step 4: Implement tối thiểu**

Không gọi `new Date()` trong domain; ngày/timestamp phải đi qua input để test deterministic. `settleLoan` không được tự tạo payment hoặc thay đổi schedule. `reopenLoan` chỉ nhận loan settled.

- [ ] **Step 5: Chạy test xanh và domain suite**

Run: `npm test -- src/lending/domain/loanLifecycle.test.ts src/lending/domain/ledger.test.ts src/lending/domain/paymentCorrections.test.ts`

- [ ] **Step 6: Commit**

```powershell
git add src/lending/domain/types.ts src/lending/domain/loanLifecycle.ts src/lending/domain/loanLifecycle.test.ts
git commit -m "feat: add manual loan settlement lifecycle"
```

**Acceptance:** Điều kiện tất toán là pure/deterministic; settle và reopen tạo đúng loan state + audit event, không làm thay đổi ledger.

## Task 5: UI tìm kiếm người vay và lọc khoản vay

**Files:**
- Modify: `src/i18n/vi.ts`
- Modify: `src/lending/ui/lendingLabels.ts`
- Modify: `src/lending/ui/BorrowerList.tsx`
- Modify: `src/lending/ui/BorrowerDetail.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/lending/ui/BorrowerList.test.tsx`
- Test: `src/lending/ui/BorrowerDetail.test.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**

```ts
export interface BorrowerListProps {
  borrowers: Borrower[];
  onSelect(id: string): void;
}

export interface BorrowerDetailProps {
  borrower: Borrower;
  loans: Loan[];
  collectionStatuses: Record<string, LoanCollectionStatus>;
  onBack(): void;
  onEdit(): void;
  onCreateLoan(): void;
  onSelectLoan(id: string): void;
}
```

- [ ] **Step 1: Viết test đỏ cho borrower list**

Render borrowers có tên `Nguyễn Văn A`, phone `0900000000` và một borrower archived. Assert ô `Tìm người vay`, select `Trạng thái người vay`, nhập `nguyen` chỉ còn đúng người có dấu, chọn `Đã lưu trữ` chỉ còn archived, và click row gọi đúng ID.

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- src/lending/ui/BorrowerList.test.tsx`

Expected: FAIL vì component chưa có search/filter controls.

- [ ] **Step 3: Viết test đỏ cho loan filters**

Render borrower detail với các loan có collection status `overdue`, `due`, `promised`, `paid`. Assert bộ lọc `Trạng thái thu tiền`, chọn `Quá hạn` chỉ còn loan overdue; chọn borrower/status filters không làm mất detail header và không thay đổi dữ liệu IndexedDB.

- [ ] **Step 4: Implement UI bằng selector domain**

Giữ query/status state cục bộ trong list component. Không lọc bằng logic riêng trong JSX; gọi `filterBorrowers`/`filterLoans`. App tạo `LoanCollectionContext` từ current entries, active payments và promises, truyền map status xuống BorrowerDetail. Thêm nhãn tiếng Việt:

```ts
searchBorrower: "Tìm người vay";
borrowerStatusFilter: "Trạng thái người vay";
loanStatusFilter: "Trạng thái khoản vay";
collectionStatusFilter: "Trạng thái thu tiền";
all: "Tất cả";
noSearchResults: "Không tìm thấy kết quả phù hợp.";
```

Dùng control native/select phù hợp iPhone, giữ nút chọn dòng và trạng thái rõ ràng.

- [ ] **Step 5: Chạy test UI và App**

Run: `npm test -- src/lending/ui/BorrowerList.test.tsx src/lending/ui/BorrowerDetail.test.tsx src/app/App.test.tsx`

Expected: PASS, toàn bộ text mới được dịch qua `vi`.

- [ ] **Step 6: Commit**

```powershell
git add src/i18n/vi.ts src/lending/ui/lendingLabels.ts src/lending/ui/BorrowerList.tsx src/lending/ui/BorrowerDetail.tsx src/lending/ui/BorrowerList.test.tsx src/lending/ui/BorrowerDetail.test.tsx src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: add Vietnamese borrower and loan filters"
```

**Acceptance:** Người dùng tìm được borrower theo tên có/không dấu hoặc số điện thoại, lọc được archive và lọc khoản vay theo các trạng thái đã duyệt.

## Task 6: UI sửa/hủy giao dịch và lịch sử điều chỉnh

**Files:**
- Modify: `src/i18n/vi.ts`
- Create: `src/lending/ui/PaymentCorrectionForm.tsx`
- Test: `src/lending/ui/PaymentCorrectionForm.test.tsx`
- Modify: `src/lending/ui/LoanDetail.tsx`
- Modify: `src/lending/ui/LoanDetail.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**

```ts
export interface PaymentCorrectionFormProps {
  payment: PaymentTransaction;
  mode: "edit" | "void";
  onSave(next: PaymentSnapshot | undefined, reason: string): Promise<void>;
  onCancel(): void;
}

export interface PaymentHistoryView {
  payment: PaymentTransaction;
  adjustments: PaymentAdjustment[];
}
```

- [ ] **Step 1: Viết test đỏ cho form correction**

Assert form hiển thị ngày/gốc/lãi/ghi chú hiện tại, thay đổi được bốn trường, bắt buộc trường `Lý do điều chỉnh`, không gọi callback khi lý do rỗng, và gọi callback với `PaymentSnapshot` + reason đã trim khi hợp lệ.

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- src/lending/ui/PaymentCorrectionForm.test.tsx`

Expected: FAIL vì component chưa tồn tại.

- [ ] **Step 3: Viết test đỏ cho LoanDetail history/actions**

Render một payment active cùng adjustment history. Assert giao dịch active hiển thị mặc định, lịch sử nằm trong vùng mở rộng với before/after/reason/time, nút `Sửa giao dịch` mở form, nút `Hủy giao dịch` yêu cầu reason/confirm, và payment `adjusted`/`voided` không tạo nút sửa/hủy mới.

Thêm test khoản vay settled không hiển thị nút ghi thu/sửa/hủy.

- [ ] **Step 4: Implement form và LoanDetail**

LoanDetail nhận thêm `paymentHistory`, `paymentAdjustments`, `onEditPayment`, `onCancelPayment`. Giao dịch active hiển thị thao tác bằng icon Lucide có accessible name/tooltip tiếng Việt. Dùng `<details>` hoặc vùng mở rộng ổn định để hiển thị before/after. Không hiển thị raw enum tiếng Anh.

`PaymentCorrectionForm` dùng trường ngày, tiền gốc, tiền lãi, ghi chú và lý do; validate bằng domain helper trước callback. Hủy giao dịch dùng xác nhận hiện có của app nhưng lý do phải được nhập trong form.

- [ ] **Step 5: Nối App orchestration**

App giữ `paymentHistory` và `paymentAdjustments` riêng với `payments` active. `refreshLendingData` gọi cả API active/history/audit. Handler sửa tạo ID mới bằng `crypto.randomUUID()`, gọi `buildPaymentCorrection`, rồi `repository.savePaymentCorrection`; handler hủy gọi `buildPaymentCancellation` và `repository.savePaymentCancellation`. Sau mỗi mutation refresh health + lending data và hiển thị thông báo tiếng Việt.

- [ ] **Step 6: Chạy test xanh**

Run: `npm test -- src/lending/ui/PaymentCorrectionForm.test.tsx src/lending/ui/LoanDetail.test.tsx src/app/App.test.tsx`

Expected: form, UI history, App persistence và các test cũ pass.

- [ ] **Step 7: Commit**

```powershell
git add src/i18n/vi.ts src/lending/ui/PaymentCorrectionForm.tsx src/lending/ui/PaymentCorrectionForm.test.tsx src/lending/ui/LoanDetail.tsx src/lending/ui/LoanDetail.test.tsx src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: add payment correction and audit UI"
```

**Acceptance:** Có thể sửa/hủy giao dịch với lý do, thấy before/after và timestamp, ledger tự tính lại, dữ liệu vẫn hoạt động sau refresh.

## Task 7: UI tất toán, mở lại và khóa thao tác

**Files:**
- Modify: `src/i18n/vi.ts`
- Modify: `src/lending/ui/LoanDetail.tsx`
- Modify: `src/lending/ui/LoanDetail.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/lending/storage/lendingRepository.ts`
- Modify: `src/lending/storage/lendingRepository.test.ts`

**Interfaces:**

```ts
export interface LoanDetailProps {
  // Existing props remain unchanged.
  lifecycleEvents: LoanLifecycleEvent[];
  onSettle(settlementDate: DateOnly): Promise<void>;
  onReopen(reason: string): Promise<void>;
}
```

- [ ] **Step 1: Viết test đỏ cho repository lifecycle mutation**

Assert `saveLoanLifecycleMutation` ghi loan + event trong cùng batch, `listLoanLifecycleEvents(loanId)` lọc đúng, và restore list giữ event. Assert loan calendar export không được tự khôi phục khi loan settled.

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- src/lending/storage/lendingRepository.test.ts`

Expected: FAIL vì lifecycle API chưa được triển khai.

- [ ] **Step 3: Viết test đỏ cho LoanDetail settlement UI**

Hai fixture:

1. Summary còn thiếu gốc/lãi: hiển thị `Chưa đủ điều kiện tất toán`, số tiền còn thiếu và không có nút xác nhận.
2. Summary bằng zero: hiển thị `Đủ điều kiện tất toán`, mở form ngày tất toán mặc định `today`, cho nhập ngày quá khứ và gọi `onSettle` đúng ngày.

Fixture settled phải hiển thị ngày tất toán, nút `Mở lại khoản vay`, bắt buộc lý do và khóa record payment/promise/revision/calendar export.

- [ ] **Step 4: Implement repository lifecycle batch**

Thêm `saveLoanLifecycleMutation` ghi bản loan đã cập nhật và `LoanLifecycleEvent`. Kiểm tra action/loan ID nhất quán ở boundary, không tạo event cho loan khác. Không dùng hard delete.

- [ ] **Step 5: Implement LoanDetail và App handlers**

LoanDetail gọi `evaluateSettlementEligibility(summary)`. Nếu eligible, form ngày tất toán mặc định prop `today`; nếu không, chỉ hiển thị số dư. App handler gọi `settleLoan`, persist mutation, refresh và thông báo `Đã tất toán khoản vay`. Reopen handler gọi `reopenLoan`, persist và thông báo `Đã mở lại khoản vay`.

Các nút ghi payment, promise, revision và export calendar phải disabled/ẩn hợp lý khi `loan.status === "settled"`. Không khóa xem history. Khi mở lại, các action trở lại theo status active.

- [ ] **Step 6: Chạy test xanh và integration**

Run: `npm test -- src/lending/storage/lendingRepository.test.ts src/lending/ui/LoanDetail.test.tsx src/app/App.test.tsx`

Expected: settlement date, reason, lifecycle history và action gating đều pass.

- [ ] **Step 7: Commit**

```powershell
git add src/i18n/vi.ts src/lending/ui/LoanDetail.tsx src/lending/ui/LoanDetail.test.tsx src/app/App.tsx src/app/App.test.tsx src/lending/storage/lendingRepository.ts src/lending/storage/lendingRepository.test.ts
git commit -m "feat: add settlement and reopen loan workflows"
```

**Acceptance:** Khoản vay chỉ tất toán thủ công khi đủ điều kiện; ngày quá khứ được giữ đúng; settled read-only; reopen có lý do và hoạt động lại đầy đủ.

## Task 8: Regression, backup recovery và responsive verification

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/lending/ui/LoanDetail.test.tsx`
- Modify: `src/backup/backupService.test.ts`
- Modify: `src/styles/global.css` nếu test viewport phát hiện tràn/chồng lấn
- No new production module unless a focused regression test exposes a defect

- [ ] **Step 1: Viết regression test cho full correction-to-settlement flow**

Trong cùng một DB test:

1. Tạo borrower/loan/schedule.
2. Ghi payment active.
3. Sửa payment thành replacement và xác nhận số dư thay đổi theo replacement.
4. Hủy replacement và xác nhận số dư quay về thiếu.
5. Ghi payment đúng số còn thiếu.
6. Xác nhận `Đủ điều kiện tất toán`, settle bằng ngày `2026-07-15`.
7. Reload App và xác nhận loan settled, history/audit vẫn hiển thị.
8. Reopen với reason, reload và xác nhận loan active.

- [ ] **Step 2: Viết backup recovery test**

Export encrypted backup sau khi có payment adjusted/voided, replacement và settled/reopened events. Reset qua UI, restore, rồi assert borrower, loan status, settledAt, payment history, adjustments và lifecycle events vẫn xuất hiện đúng.

- [ ] **Step 3: Chạy toàn bộ verification suite**

```powershell
npm test
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: toàn bộ test pass, typecheck/build pass, diff check không báo lỗi. Build phải vẫn tạo `dist/manifest.webmanifest` và `dist/sw.js`.

- [ ] **Step 4: Kiểm tra giao diện ở viewport iPhone**

Dùng browser/dev server hiện có hoặc preview server trên port trống. Kiểm tra các màn hình:

- Danh sách borrower có search/filter.
- Borrower detail có loan filters.
- Loan detail có bảng lịch sử và form correction.
- Settlement/reopen form.

Không có text tràn parent, nút chồng nhau hoặc action icon không có accessible name. Nếu có lỗi, viết regression test hoặc sửa CSS nhỏ trong cùng task rồi chạy lại suite.

- [ ] **Step 5: Commit verification fix nếu có**

```powershell
git add src/app/App.test.tsx src/lending/ui/LoanDetail.test.tsx src/backup/backupService.test.ts src/styles/global.css
git commit -m "test: verify payment correction and settlement recovery"
```

Nếu không có production/test fix, không tạo commit rỗng.

**Acceptance:** Toàn bộ vertical flow chạy offline, backup/restore phục hồi audit trail, giao diện tiếng Việt không vỡ ở kích thước iPhone và build production thành công.

## SDD Execution Protocol

Khi bắt đầu thực hiện plan này:

1. Tạo worktree riêng bằng `superpowers:using-git-worktrees`; không code trực tiếp trên `main`.
2. Chạy `scripts/sdd-workspace docs/superpowers/plans/2026-07-29-payment-corrections-search-settlement-implementation.md` và tạo ledger riêng cho plan.
3. Đọc plan một lần, tạo todo cho Task 1 đến Task 8, kiểm tra không có xung đột trước khi dispatch.
4. Với từng task, chạy `scripts/task-brief <plan> <task-number>` và giao brief đó cho implementer mới.
5. Implementer phải dùng TDD, tự chạy test, commit và ghi report file.
6. Chạy `scripts/review-package <plan> <base> <head>` rồi dispatch task reviewer. Finding Critical/Important phải đi qua fix loop và re-review; không tự sửa trong controller.
7. Ghi `Task N: complete` vào ledger chỉ sau khi reviewer sạch hoặc finding đã được park theo đúng quy trình.
8. Sau Task 8, dispatch broad whole-branch review, xử lý một fix wave nếu có, chạy verification cuối và dùng `superpowers:finishing-a-development-branch`.

## Spec Coverage Checklist

- [ ] Giao dịch gốc không bị xóa/ghi đè.
- [ ] Sửa tạo replacement và audit before/after/reason/timestamp.
- [ ] Hủy giữ lịch sử và loại khỏi ledger.
- [ ] Reason bắt buộc cho sửa/hủy/mở lại.
- [ ] Không đổi borrower/loan/schedule link trong correction.
- [ ] Tìm kiếm borrower theo tên có/không dấu và phone.
- [ ] Lọc borrower active/archived.
- [ ] Lọc loan theo borrower, loan status, collection status.
- [ ] Ledger chỉ tính payment active.
- [ ] Tất toán thủ công khi principal + interest outstanding bằng zero.
- [ ] Settlement date tách khỏi maturity date và cho phép ngày quá khứ.
- [ ] Settled loan khóa mutation mới nhưng vẫn xem history.
- [ ] Reopen có lý do, event và quay về active.
- [ ] Backup/restore giữ payment audit và lifecycle audit.
- [ ] Toàn bộ UI mới là tiếng Việt.
- [ ] Test, typecheck, build và viewport iPhone pass.

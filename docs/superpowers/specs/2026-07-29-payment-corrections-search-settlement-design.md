# Thiết kế sửa giao dịch, tìm kiếm và tất toán

Ngày: 2026-07-29  
Trạng thái: Đã duyệt để lập implementation plan

## Mục tiêu

Mở rộng app quản lý cho vay hiện tại để hỗ trợ ba nhóm nghiệp vụ:

1. Sửa hoặc hủy giao dịch thu tiền nhưng vẫn giữ lịch sử đầy đủ.
2. Tìm kiếm và lọc người vay, khoản vay theo các trạng thái cần xử lý.
3. Tất toán thủ công, mở lại khoản vay khi cần điều chỉnh dữ liệu, và giữ lịch sử vòng đời.

Mọi dữ liệu tiếp tục được lưu local-first trong IndexedDB, sử dụng được offline và đi cùng backup mã hóa hiện có. Không thêm backend, tài khoản người dùng, đồng bộ cloud hoặc Push Notification trong phạm vi này.

## Quyết định đã xác nhận

- Giao dịch gốc không bị xóa hoặc ghi đè.
- Khi sửa, giao dịch gốc chuyển thành `Đã điều chỉnh`; app tạo một giao dịch thay thế đang có hiệu lực.
- Khi hủy, giao dịch gốc chuyển thành `Đã hủy`; không tạo giao dịch thay thế.
- Sửa và hủy đều bắt buộc nhập lý do.
- Chỉ được sửa ngày nhận tiền, tiền gốc, tiền lãi và ghi chú.
- Không được đổi người vay, khoản vay hoặc kỳ thanh toán liên kết của một giao dịch hiện có.
- Nếu liên kết sai, phải hủy giao dịch cũ rồi tạo giao dịch mới đúng liên kết.
- Lịch sử điều chỉnh hiển thị mở rộng bên dưới từng giao dịch.
- Giao dịch đã điều chỉnh hoặc đã hủy không được tính vào số dư, trạng thái kỳ hoặc báo cáo.
- Người vay được tìm theo tên và số điện thoại, có lọc đang hoạt động/đã lưu trữ.
- Khoản vay được lọc theo người vay, trạng thái khoản vay và trạng thái thu tiền.
- Chỉ được tất toán khi cả gốc còn phải thu và lãi còn phải thu đều bằng `0`.
- Tất toán là xác nhận thủ công, không tự động khi số dư bằng `0`.
- Ngày tất toán là ngày thực tế riêng, mặc định hôm nay nhưng cho phép chọn ngày quá khứ.
- Có thể mở lại khoản vay đã tất toán, bắt buộc nhập lý do và ghi lịch sử.
- Giao diện mới và toàn bộ nội dung hiển thị trong app phải bằng tiếng Việt.

## Phạm vi không làm

- Không sửa trực tiếp lịch sử đã ghi nhận.
- Không tự động chuyển giao dịch sang kỳ khác.
- Không tự động tất toán khoản vay.
- Không tự động gửi thông báo lặp lại cho khoản quá hạn.
- Không cho nhiều người dùng cùng thao tác.
- Không triển khai đồng bộ cloud hoặc Push Notification.

## Kiến trúc dữ liệu

### Trạng thái giao dịch

Thêm trạng thái cho `PaymentTransaction`:

```ts
type PaymentStatus = "active" | "adjusted" | "voided";
```

Các bản ghi giao dịch cũ chưa có `status` được chuẩn hóa thành `active` khi đọc. Không cần sửa lại toàn bộ backup cũ trước khi sử dụng.

Giao dịch đang hiệu lực là giao dịch duy nhất được dùng trong phép tính công nợ. Giao dịch `adjusted` và `voided` chỉ phục vụ lịch sử, kiểm tra và backup.

### Ảnh chụp giao dịch

Lịch sử điều chỉnh dùng ảnh chụp có cấu trúc, không dùng một chuỗi mô tả không thể phân tích:

```ts
interface PaymentSnapshot {
  scheduleEntryId?: string;
  receivedAt: DateOnly;
  principalAmount: MoneyVnd;
  interestAmount: MoneyVnd;
  note?: string;
}
```

Ảnh chụp không có `borrowerId` hoặc `loanId` vì hai liên kết này không được phép thay đổi trong luồng sửa.

### Lịch sử điều chỉnh giao dịch

```ts
interface PaymentAdjustment {
  id: string;
  loanId: string;
  paymentId: string;
  replacementPaymentId?: string;
  action: "edit" | "void";
  reason: string;
  before: PaymentSnapshot;
  after?: PaymentSnapshot;
  createdAt: Timestamp;
}
```

Quy tắc tạo dữ liệu:

- Sửa giao dịch tạo một `PaymentAdjustment` với `action: "edit"`, chuyển giao dịch cũ thành `adjusted`, sau đó tạo giao dịch thay thế với ID mới và trạng thái `active`.
- Hủy giao dịch tạo một `PaymentAdjustment` với `action: "void"`, chuyển giao dịch cũ thành `voided`, không tạo bản ghi thay thế.
- Ba thao tác trên phải được ghi trong cùng một giao dịch lưu trữ để không xảy ra trạng thái lịch sử dở dang.
- Giao dịch thay thế giữ nguyên `loanId` và `scheduleEntryId` của giao dịch gốc.
- Lý do phải khác chuỗi rỗng sau khi loại bỏ khoảng trắng.

### Vòng đời khoản vay

`Loan.status` hiện có các trạng thái `draft`, `active`, `settled`, `archived`. Bổ sung:

```ts
settledAt?: DateOnly;
```

Tạo thêm bản ghi lịch sử vòng đời:

```ts
interface LoanLifecycleEvent {
  id: string;
  loanId: string;
  action: "settled" | "reopened";
  effectiveDate: DateOnly;
  reason?: string;
  createdAt: Timestamp;
}
```

Quy tắc:

- `settled` phải có `effectiveDate`, mặc định bằng ngày hiện tại của người dùng.
- `reopened` bắt buộc có lý do.
- Tất toán chỉ được thực hiện khi số gốc và lãi còn phải thu đều bằng `0`.
- Mở lại xóa giá trị `settledAt`, chuyển khoản vay về `active` và lưu sự kiện `reopened`.
- Một khoản vay đã tất toán vẫn giữ các giao dịch và sự kiện trước đó.
- Khoản vay `settled` không được tạo giao dịch, lời hứa trả hoặc lịch nhắc mới cho đến khi được mở lại.

### Lưu trữ và backup

Thêm các loại bản ghi:

- `payment-adjustment`
- `loan-lifecycle-event`

Backup mã hóa phải chứa cả bản ghi đang hiệu lực và bản ghi lịch sử. Restore phải khôi phục được thứ tự và liên kết giữa giao dịch gốc, giao dịch thay thế, lịch sử điều chỉnh và sự kiện vòng đời.

## Quy tắc ledger sau điều chỉnh

Các hàm tính toán hiện tại tiếp tục là nguồn tính số dư, nhưng chỉ nhận giao dịch đang hiệu lực.

```text
Gốc đã thu của kỳ = tổng principalAmount của payment active
Lãi đã thu của kỳ = tổng interestAmount của payment active
Gốc còn phải thu = max(0, gốc phải thu - gốc đã thu)
Lãi còn phải thu = max(0, lãi phải thu - lãi đã thu)
```

Việc sửa hoặc hủy giao dịch phải làm mới các giá trị dẫn xuất:

- Tổng gốc đã thu.
- Tổng lãi đã thu.
- Gốc còn phải thu.
- Lãi còn phải thu.
- Trạng thái kỳ.
- Trạng thái thu tiền của khoản vay.
- Điều kiện tất toán.

Không tự động phân bổ lại giao dịch giữa các kỳ. Nếu cần đổi kỳ liên kết, dùng luồng hủy giao dịch cũ và tạo giao dịch mới.

## Repository và domain service

Repository hiện tại được mở rộng theo hướng giữ API đọc đơn giản và tách dữ liệu hiệu lực khỏi lịch sử:

```ts
listPayments(loanId?: string): Promise<PaymentTransaction[]>;
listPaymentHistory(loanId?: string): Promise<PaymentTransaction[]>;
listPaymentAdjustments(loanId?: string): Promise<PaymentAdjustment[]>;
savePaymentCorrection(input: PaymentCorrectionInput): Promise<void>;
savePaymentCancellation(input: PaymentCancellationInput): Promise<void>;
listLoanLifecycleEvents(loanId?: string): Promise<LoanLifecycleEvent[]>;
saveLoanLifecycleEvent(value: LoanLifecycleEvent): Promise<void>;
```

`listPayments` mặc định trả các giao dịch `active` để các màn hình tổng quan không vô tình tính giao dịch lịch sử. `listPaymentHistory` trả toàn bộ trạng thái để màn hình chi tiết hiển thị lịch sử. Dữ liệu cũ được normalize trước khi lọc.

Các quy tắc bắt buộc như lý do, điều kiện tất toán và chuyển trạng thái phải nằm ở domain service hoặc hàm nghiệp vụ thuần, không chỉ kiểm tra trong React component.

## Thiết kế tìm kiếm và lọc

### Người vay

Tìm kiếm trên `displayName` và `phone` sau khi chuẩn hóa:

- Chuyển về chữ thường.
- Loại bỏ dấu tiếng Việt để tìm kiếm thuận tiện trên iPhone.
- Chuẩn hóa khoảng trắng và ký tự số điện thoại.

Bộ lọc mặc định là người vay đang hoạt động. Người dùng có thể chọn tất cả hoặc đã lưu trữ. Tìm kiếm và bộ lọc chỉ là state giao diện, không ghi vào IndexedDB.

### Khoản vay

Bộ lọc gồm:

- Người vay cụ thể hoặc tất cả.
- `Đang hoạt động`, `Đã tất toán`, `Đã lưu trữ`.
- `Sắp đến hạn`, `Đến hạn`, `Đã hứa trả`, `Quá hạn`, `Đã thu đủ`.

Một khoản vay có thể có nhiều kỳ với trạng thái khác nhau. Trạng thái thu tiền tổng hợp theo ưu tiên:

1. Có ít nhất một kỳ `overdue` thì hiển thị `Quá hạn`.
2. Nếu không quá hạn nhưng có kỳ `due`, `partially-paid` hoặc còn thiếu thì hiển thị `Đến hạn`.
3. Nếu có lời hứa trả đang mở và chưa thuộc hai nhóm trên thì hiển thị `Đã hứa trả`.
4. Nếu các kỳ đã đến hạn đều thu đủ và kỳ tiếp theo còn ở tương lai thì hiển thị `Sắp đến hạn`.
5. `Đã thu đủ` dùng cho khoản vay không còn kỳ đến hạn nào đang thiếu tiền nhưng vẫn còn nghĩa vụ tương lai; khoản vay đã kết thúc được phân biệt bằng trạng thái `Đã tất toán`.

Các selector nhận `today` từ bên ngoài để có thể kiểm thử ổn định và không phụ thuộc trực tiếp vào đồng hồ hệ thống.

## Thiết kế màn hình

### Danh sách người vay

Hiển thị:

- Ô tìm kiếm theo tên hoặc số điện thoại.
- Bộ lọc `Tất cả`, `Đang hoạt động`, `Đã lưu trữ`.
- Tên, số điện thoại, số khoản vay đang hoạt động và tổng tiền còn phải thu.
- Nút thêm người vay.

Nhãn và thông báo phải bằng tiếng Việt. Khi không có kết quả, hiển thị trạng thái rỗng phù hợp với bộ lọc hiện tại.

### Danh sách khoản vay

Hiển thị bộ lọc người vay, trạng thái khoản vay và trạng thái thu tiền. Mỗi khoản vay hiển thị người vay, gốc ban đầu, số còn phải thu, ngày đến hạn gần nhất và nhãn trạng thái.

### Chi tiết khoản vay

Các khu vực theo thứ tự:

1. Thông tin người vay và khoản vay.
2. Tổng gốc còn phải thu, tổng lãi còn phải thu và tổng đã thu.
3. Lịch thanh toán với gốc/lãi phải thu, đã thu, còn thiếu và trạng thái.
4. Lịch sử giao dịch.
5. Lời hứa trả.
6. Lịch sử điều chỉnh và sự kiện vòng đời.
7. Khu vực tất toán hoặc mở lại.

Giao dịch hiện tại hiển thị mặc định. Lịch sử điều chỉnh mở rộng bên dưới giao dịch liên quan, gồm trước/sau, loại thao tác, lý do và thời điểm. Dòng đã hủy hoặc đã điều chỉnh có nhãn trạng thái nhưng không được làm nổi bật hơn giao dịch đang hiệu lực.

### Luồng sửa giao dịch

1. Chọn biểu tượng thao tác trên giao dịch đang hiệu lực.
2. Chọn `Sửa giao dịch`.
3. Nhập ngày nhận tiền, gốc, lãi, ghi chú và lý do.
4. Kiểm tra dữ liệu trước/sau.
5. Xác nhận.
6. Hiển thị giao dịch thay thế và lịch sử điều chỉnh.

Nếu thiếu lý do hoặc số tiền không hợp lệ, không ghi dữ liệu.

### Luồng hủy giao dịch

1. Chọn `Hủy giao dịch`.
2. Hiển thị số tiền và kỳ bị ảnh hưởng.
3. Nhập lý do bắt buộc.
4. Xác nhận hủy.
5. Tính lại số dư và trạng thái kỳ.

Không dùng thao tác xóa vật lý trong giao diện tài chính.

### Luồng tất toán và mở lại

Khi còn thiếu gốc hoặc lãi, khu vực tất toán hiển thị số tiền còn thiếu và không cho xác nhận.

Khi đủ điều kiện, hiển thị `Đủ điều kiện tất toán` và nút `Tất toán khoản vay`. Biểu mẫu ngày tất toán mặc định hôm nay nhưng cho phép nhập ngày quá khứ.

Khoản vay đã tất toán hiển thị ngày tất toán và nút `Mở lại khoản vay`. Luồng mở lại bắt buộc nhập lý do. Sau khi mở lại, các thao tác thu tiền và điều chỉnh được bật lại.

## Trạng thái giao diện và nội dung tiếng Việt

Các trạng thái tối thiểu:

- Đang hiệu lực
- Đã điều chỉnh
- Đã hủy
- Đủ điều kiện tất toán
- Chưa đủ điều kiện tất toán
- Đã tất toán
- Đã mở lại
- Không có dữ liệu
- Không tìm thấy kết quả

Tên enum và khóa dữ liệu nội bộ có thể tiếp tục dùng tiếng Anh để ổn định code và backup. Chỉ giá trị hiển thị, nhãn, nút, lỗi xác thực, thông báo thành công và xác nhận trong app phải Việt hóa.

## Kiểm thử và tiêu chí chấp nhận

### Domain và repository

- Giao dịch cũ không có `status` được hiểu là `active`.
- Sửa giao dịch tạo đúng một bản thay thế và một lịch sử điều chỉnh.
- Hủy giao dịch không tạo bản thay thế.
- Giao dịch cũ không được tính vào ledger sau sửa/hủy.
- Thiếu lý do thì thao tác bị từ chối.
- Không thể đổi `loanId` hoặc `scheduleEntryId` trong correction flow.
- Lịch sử điều chỉnh giữ đúng before/after và timestamp.
- Tất toán bị từ chối khi còn thiếu gốc hoặc lãi.
- Tất toán lưu đúng ngày thực tế đã chọn.
- Mở lại bắt buộc lý do và tạo lifecycle event.
- Backup/restore giữ nguyên các bản ghi điều chỉnh và vòng đời.

### Selector và UI

- Tìm kiếm tên có dấu và không dấu cho cùng kết quả.
- Tìm được người vay theo số điện thoại.
- Lọc người vay active/archived chính xác.
- Lọc khoản vay theo người vay, trạng thái khoản vay và trạng thái thu tiền.
- Giao dịch đã hủy/điều chỉnh có thể mở lịch sử nhưng không làm thay đổi tổng số.
- Khoản vay đã tất toán ở chế độ chỉ đọc.
- Mở lại khoản vay bật đúng các thao tác bị khóa.
- Ngày tháng, tiền VND, lỗi và nút thao tác hiển thị bằng tiếng Việt.
- Giao diện không làm tràn hoặc chồng lấn ở kích thước iPhone.

## Ranh giới triển khai

Phạm vi này không thay đổi công thức tính lãi hoặc cách tạo lịch đã được duyệt. Nó chỉ thay đổi nguồn giao dịch được tính, bổ sung lịch sử điều chỉnh, selector lọc và vòng đời tất toán. Các báo cáo về tổng gốc, tổng lãi, đã thu và còn phải thu ở bước sau phải dùng cùng ledger hiệu lực này.

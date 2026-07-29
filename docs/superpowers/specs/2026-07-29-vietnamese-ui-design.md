# Thiết kế Việt hóa giao diện

## Mục tiêu

Việt hóa toàn bộ nội dung người dùng nhìn thấy trong PWA quản lý tiền lãi. Thay đổi chỉ nằm ở giao diện và thông báo; không thay đổi nghiệp vụ tính lãi, dữ liệu IndexedDB, dữ liệu backup, cấu trúc Calendar hoặc tài liệu kỹ thuật.

## Phạm vi

Việt hóa các nhóm sau:

- Tên app, điều hướng và tiêu đề màn hình.
- Dashboard và các nhóm trạng thái khoản vay.
- Form người vay, khoản vay, thanh toán, hứa trả, chỉnh lịch và reminder.
- Lịch sử kỳ thanh toán, giao dịch và phiên bản lịch.
- Backup, restore, reset, trạng thái online/offline và thông báo kết quả.
- Nhãn biểu mẫu, thông báo lỗi, nút bấm, trạng thái rỗng và aria-label.

Không Việt hóa:

- Tên biến, enum, record type và mã trạng thái nội bộ.
- Dữ liệu đã lưu trong IndexedDB hoặc backup.
- Tên file và cấu trúc `.ics`.
- `README.md` và tài liệu kỹ thuật.

## Kiến trúc nhãn

Tạo một module từ điển giao diện tiếng Việt tại `src/i18n/vi.ts`, chia theo nhóm `common`, `navigation`, `borrower`, `loan`, `payment`, `promise`, `reminder`, `calendar`, `backup`, `status` và `errors`.

Các nhãn dùng chung như trạng thái, mô hình tính, đơn vị lãi suất và chế độ kỳ không trọn tháng được lấy từ module này hoặc module nhãn hiện có sau khi quy về cùng nguồn. Không thêm thư viện i18n để giữ bundle nhỏ, offline-first và không phát sinh chi phí runtime.

Các lỗi domain chỉ được hiển thị cho người dùng sẽ được ánh xạ ở biên giao diện sang tiếng Việt. Mã lỗi và logic ném lỗi không thay đổi nếu không cần thiết.

## Định dạng hiển thị

- Tiền hiển thị theo cách Việt Nam, ví dụ `1.000.000 đ`.
- Ngày nhập liệu giữ định dạng `YYYY-MM-DD` để không làm sai dữ liệu ngày.
- Các giá trị nội bộ được dịch khi hiển thị, ví dụ `active` thành `Đang hoạt động`, `paid` thành `Đã trả đủ`, `overdue` thành `Quá hạn`.
- Tên app hiển thị là `Quản lý tiền lãi`.

## Kiểm thử và chấp nhận

- Các test UI sử dụng nhãn tiếng Việt mới cho role, label, heading và thông báo.
- Bổ sung hoặc cập nhật test cho dashboard, form chính, thông báo validation và trạng thái offline/backup.
- Không thay đổi test domain nếu test chỉ kiểm tra mã trạng thái hoặc giá trị dữ liệu nội bộ.
- `npm test`, `npm run typecheck` và `npm run build` phải đạt sau khi Việt hóa.
- Rà soát chuỗi hiển thị để không còn tiếng Anh trong luồng thao tác chính.

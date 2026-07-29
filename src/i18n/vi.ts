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

const exactErrorTranslations: Record<string, string> = {
  "Display name is required": vi.errors.displayNameRequired,
  "Could not save borrower": vi.errors.genericBorrowerSave,
  "Could not save loan": vi.errors.genericLoanSave,
  "Could not save payment": vi.errors.genericPaymentSave,
  "Could not save promise": vi.errors.genericPromiseSave,
  "Could not save reminder settings": vi.errors.genericReminderSave,
  "Could not save revision": vi.errors.genericRevisionSave,
  "Could not preview schedule": vi.errors.previewFailed,
  "Received date is required": "Vui lòng nhập ngày thu",
  "Promised date is required": "Vui lòng nhập ngày hứa trả",
  "Promise note is required": vi.errors.requiredPromiseNote,
  "At least one received amount must be positive": vi.errors.positiveAmount,
  "Reminder offset must be a non-negative whole number": vi.errors.invalidReminderOffset,
  "Reminder time must use HH:MM": vi.errors.invalidReminderTime,
  "Loan reminder offset must be a non-negative whole number": vi.errors.invalidReminderOffset,
  "Loan reminder time must use HH:MM": vi.errors.invalidReminderTime,
  "Could not save loan reminders": vi.errors.genericReminderSave,
  "Could not clear loan reminder override": vi.errors.genericReminderSave,
  "Could not save calendar export": vi.errors.calendarPreparationFailed,
};

function translateDynamicError(message: string): string | undefined {
  if (message.startsWith("Invalid date-only value: ")) return `Giá trị ngày không hợp lệ: ${message.slice("Invalid date-only value: ".length)}`;
  if (message.startsWith("Principal base must be")) return "Tiền gốc cơ sở phải là số nguyên dương";
  if (message.startsWith("Principal received must be")) return "Gốc đã thu phải là số nguyên";
  if (message.startsWith("Principal must be")) return "Tiền gốc phải là số nguyên dương";
  if (message.startsWith("Monthly due day")) return "Ngày thu hàng tháng phải từ 1 đến 31";
  if (message.startsWith("effectiveDate must not be before")) return "Ngày áp dụng không được trước ngày giải ngân";
  if (message.startsWith("effectiveDate must not move backwards")) return "Ngày áp dụng không được lùi so với phiên bản trước";
  return undefined;
}

export function translateError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return exactErrorTranslations[message] ?? translateDynamicError(message) ?? fallback;
}

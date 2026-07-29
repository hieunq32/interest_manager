export const vi = {
  appName: "Quản lý tiền lãi",
  navigation: { home: "Trang chủ", settings: "Cài đặt" },
  common: {
    save: "Lưu", cancel: "Hủy", back: "Quay lại", note: "Ghi chú", actions: "Thao tác", status: "Trạng thái",
    to: "đến", none: "Không có", all: "Tất cả", unassigned: "Chưa phân bổ", primaryNavigation: "Điều hướng chính", systemStatus: "Trạng thái hệ thống",
  },
  shellStatus: {
    online: "Đang online",
    offline: "Đang offline",
    recordCount: (count: number) => `${count} bản ghi`,
    storage: {
      "Checking storage": "Đang kiểm tra bộ nhớ",
      "Storage ready": "Bộ nhớ sẵn sàng",
      "Storage unavailable": "Bộ nhớ không khả dụng",
    },
    messages: {
      "Ready": "Sẵn sàng",
      "Offline cache unavailable": "Bộ nhớ đệm ngoại tuyến không khả dụng",
      "Borrower saved": "Đã lưu người vay",
      "Borrower archived": "Đã lưu trữ người vay",
      "Loan saved": "Đã lưu khoản vay",
      "Payment recorded": "Đã ghi nhận khoản thu",
      "Promise recorded": "Đã ghi nhận lời hứa trả",
      "Promise fulfilled": "Đã đánh dấu lời hứa đã thực hiện",
      "Promise cancelled": "Đã hủy lời hứa trả",
      "Reminder settings saved": "Đã lưu cài đặt nhắc hạn",
      "Loan reminder override saved": "Đã lưu cấu hình nhắc hạn riêng cho khoản vay",
      "Loan reminder override cleared": "Đã xóa cấu hình nhắc hạn riêng cho khoản vay",
      "Schedule revised; Calendar export is stale": "Đã điều chỉnh lịch thu; lịch Calendar cần xuất lại",
      "Calendar export marked current": "Đã cập nhật trạng thái lịch Calendar",
      "Calendar export could not be prepared": "Không thể chuẩn bị lịch Calendar",
      "Backup passphrase required": "Vui lòng nhập mật khẩu sao lưu",
      "Backup exported": "Đã xuất bản sao lưu",
      "Reset cancelled": "Đã hủy xóa dữ liệu",
      "Local lending data reset": "Đã xóa dữ liệu cho vay cục bộ",
      "Restore passphrase required": "Vui lòng nhập mật khẩu khôi phục",
      "Restore cancelled": "Đã hủy khôi phục",
      "Backup restored": "Đã khôi phục bản sao lưu",
      "Invalid backup file": "Tệp sao lưu không hợp lệ",
      "Unsupported backup version": "Phiên bản sao lưu không được hỗ trợ",
      "Wrong backup passphrase": "Mật khẩu sao lưu không đúng",
      "Restore failed": "Khôi phục thất bại",
      unknown: "Đã xảy ra lỗi. Vui lòng thử lại.",
    },
  },
  status: {
    active: "Đang hoạt động", archived: "Đã lưu trữ", settled: "Đã tất toán", draft: "Bản nháp",
    upcoming: "Sắp đến hạn", due: "Đến hạn", promised: "Đã hứa trả", partiallyPaid: "Đã trả một phần",
    overdue: "Quá hạn", paid: "Đã trả đủ", open: "Đang mở", fulfilled: "Đã thực hiện", cancelled: "Đã hủy", expired: "Đã hết hạn",
  },
  borrower: {
    title: "Người vay", new: "Thêm người vay", edit: "Sửa người vay", save: "Lưu người vay", unknown: "Không rõ người vay",
    archive: "Lưu trữ người vay", displayName: "Tên hiển thị", phone: "Số điện thoại",
    note: "Ghi chú", loans: "Các khoản vay", noBorrowers: "Chưa có người vay nào.",
    noLoans: "Người vay này chưa có khoản vay nào.", notFound: "Không tìm thấy người vay",
    searchBorrower: "Tìm người vay", borrowerStatusFilter: "Trạng thái người vay", noSearchResults: "Không tìm thấy kết quả phù hợp.",
  },
  loan: {
    title: "Khoản vay", new: "Thêm khoản vay", details: "Chi tiết khoản vay", notFound: "Không tìm thấy khoản vay",
    principal: "Tiền gốc (đ)", disbursementDate: "Ngày giải ngân", calculationModel: "Mô hình tính",
    monthlyDueDay: "Ngày thu hàng tháng", maturityDate: "Ngày tất toán", rate: "Lãi suất (%)",
    rateUnit: "Đơn vị lãi suất", partialPeriod: "Cách tính lãi kỳ không trọn tháng", note: "Ghi chú",
    preview: "Xem trước lịch thu", previewDueDate: "Ngày đến hạn", previewPrincipal: "Gốc", previewInterest: "Lãi", interest: "Lãi", confirmSave: "Xác nhận và lưu khoản vay", currentBalance: "Dư nợ hiện tại",
    outstandingPrincipal: "Gốc còn phải thu", outstandingInterest: "Lãi còn phải thu", nextDueDate: "Ngày thu tiếp theo",
    versions: "Các phiên bản lịch thu", active: "đang áp dụng", readOnly: "chỉ xem", originalDue: "Ngày đến hạn gốc",
    loanStatusFilter: "Trạng thái khoản vay", collectionStatusFilter: "Trạng thái thu tiền",
  },
  payment: {
    record: "Ghi nhận khoản thu", history: "Lịch sử thu tiền", receivedDate: "Ngày thu",
    principalReceived: "Gốc đã thu (đ)", interestReceived: "Lãi đã thu (đ)", scheduleEntry: "Kỳ thu",
    save: "Lưu khoản thu", noPayments: "Chưa có khoản thu nào.", received: "Đã thu", expected: "Dự kiến", outstanding: "Còn phải thu",
  },
  promise: {
    record: "Ghi nhận lời hứa trả", history: "Lịch sử hứa trả", promisedDate: "Ngày hứa trả",
    promisedPrincipal: "Gốc hứa trả (đ)", promisedInterest: "Lãi hứa trả (đ)", note: "Ghi chú hứa trả", save: "Lưu lời hứa trả", fulfil: "Đánh dấu đã thực hiện", cancel: "Hủy lời hứa trả",
    noPromises: "Chưa có lời hứa trả nào.", promise: "Lời hứa trả",
  },
  revision: {
    title: "Điều chỉnh lịch thu", newVersion: "Phiên bản lịch thu mới", effectiveDate: "Ngày áp dụng", adjustmentReason: "Lý do điều chỉnh", save: "Lưu phiên bản lịch mới",
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
    title: "Sao lưu", restore: "Khôi phục", reset: "Xóa dữ liệu", operations: "Sao lưu và khôi phục", backupPassphrase: "Mật khẩu sao lưu",
    restorePassphrase: "Mật khẩu khôi phục", file: "Tệp sao lưu", backup: "Sao lưu", resetLending: "Xóa dữ liệu cho vay",
    resetConfirm: "Xóa toàn bộ dữ liệu cho vay cục bộ?", restoreConfirm: "Thay thế các bản ghi cục bộ bằng bản sao lưu này?",
  },
  errors: {
    displayNameRequired: "Tên hiển thị là bắt buộc", genericBorrowerSave: "Không thể lưu người vay",
    genericLoanSave: "Không thể lưu khoản vay", genericPaymentSave: "Không thể lưu khoản thu",
    genericPromiseSave: "Không thể lưu lời hứa trả", genericReminderSave: "Không thể lưu cài đặt nhắc hạn",
    genericRevisionSave: "Không thể lưu phiên bản lịch", previewFailed: "Không thể xem trước lịch thu",
    requiredDate: "Vui lòng nhập ngày bắt buộc", positiveAmount: "Số tiền phải lớn hơn 0",
    requiredPromiseNote: "Ghi chú hứa trả là bắt buộc", requiredReason: "Vui lòng nhập lý do điều chỉnh",
    requiredLoanDates: "Vui lòng nhập ngày giải ngân và ngày tất toán", requiredRevisionDates: "Vui lòng nhập ngày áp dụng, ngày giải ngân và ngày tất toán",
    maturityAfterDisbursement: "Ngày tất toán phải sau ngày giải ngân", effectiveBeforeMaturity: "Ngày áp dụng phải trước ngày tất toán",
    nonNegativeRate: "Lãi suất phải là số không âm", adjustmentReasonRequired: "Vui lòng nhập lý do điều chỉnh khi thay đổi lãi suất hoặc đơn vị lãi suất",
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
  "Disbursement and maturity dates are required": vi.errors.requiredLoanDates,
  "Effective, disbursement, and maturity dates are required": vi.errors.requiredRevisionDates,
  "Maturity date must be after disbursement date": vi.errors.maturityAfterDisbursement,
  "maturityDate must be after disbursementDate": vi.errors.maturityAfterDisbursement,
  "Rate must be a non-negative number": vi.errors.nonNegativeRate,
  "A non-empty adjustment reason is required when changing the rate or rate unit": vi.errors.adjustmentReasonRequired,
  "enabled must be a boolean": "Trạng thái bật nhắc hạn phải là giá trị đúng hoặc sai",
  "offsetDays must be a non-negative integer": "Số ngày nhắc trước phải là số nguyên không âm",
  "time must use HH:MM in 24-hour time": "Giờ nhắc phải có dạng HH:MM trong hệ 24 giờ",
  "dtstampUtc must be an ISO UTC timestamp": "Dấu thời gian UTC phải có dạng ISO",
  "dtstampUtc must be a valid ISO UTC timestamp": "Dấu thời gian UTC phải là thời điểm ISO hợp lệ",
  "reminderOffsetDays must be a non-negative integer": "Số ngày nhắc trước phải là số nguyên không âm",
  "month must be between 1 and 12": "Tháng phải từ 1 đến 12",
  "due day must be between 1 and 31": "Ngày đến hạn phải từ 1 đến 31",
  "year must be between 0 and 9999": "Năm phải từ 0 đến 9999",
  "end date cannot be before start date": "Ngày kết thúc không được trước ngày bắt đầu",
  "rateValue must be a finite number": "Giá trị lãi suất phải là số hữu hạn",
  "rateValue must be non-negative": vi.errors.nonNegativeRate,
  "period must span at least one calendar day": "Kỳ tính lãi phải kéo dài ít nhất một ngày dương lịch",
  "rateUnit must be monthly or daily": "Đơn vị lãi suất phải là theo tháng hoặc theo ngày",
  "partialPeriodInterestMode is invalid": "Cách tính lãi kỳ không trọn tháng không hợp lệ",
  "money must be a finite number": "Số tiền phải là số hữu hạn",
  "money must be non-negative": "Số tiền không được âm",
  "money must round to a safe integer": "Số tiền phải làm tròn thành số nguyên an toàn",
  "Invalid backup file": "Tệp sao lưu không hợp lệ",
  "Unsupported backup version": "Phiên bản sao lưu không được hỗ trợ",
  "Invalid backup payload": "Nội dung sao lưu không hợp lệ",
  "Invalid backup records": "Bản ghi sao lưu không hợp lệ",
  "Unable to decrypt backup payload": "Không thể giải mã nội dung sao lưu",
  "IndexedDB is unavailable": "Bộ nhớ cục bộ không khả dụng",
};

function translateDynamicError(message: string): string | undefined {
  if (message.startsWith("Invalid date-only value: ")) return `Giá trị ngày không hợp lệ: ${message.slice("Invalid date-only value: ".length)}`;
  if (message.startsWith("Principal base must be")) return "Tiền gốc cơ sở phải là số nguyên dương";
  if (message.startsWith("Principal received must be")) return "Gốc đã thu phải là số nguyên";
  if (message.startsWith("Principal must be")) return "Tiền gốc phải là số nguyên dương";
  if (message.startsWith("Monthly due day")) return "Ngày thu hàng tháng phải từ 1 đến 31";
  if (message.startsWith("effectiveDate must not be before")) return "Ngày áp dụng không được trước ngày giải ngân";
  if (message.startsWith("effectiveDate must not move backwards")) return "Ngày áp dụng không được lùi so với phiên bản trước";
  if (message === "effectiveDate must be before maturityDate") return vi.errors.effectiveBeforeMaturity;
  const moneyError = /^(principalBase|Payment amount|Principal received|Interest received|Promised principal|Promised interest) (must be a finite number|must be non-negative|must be an integer|must be a safe integer)$/.exec(message);
  if (moneyError?.[2] === "must be a finite number") return "Giá trị phải là số hữu hạn";
  if (moneyError?.[2] === "must be non-negative") return "Giá trị không được âm";
  if (moneyError?.[2] === "must be an integer") return "Giá trị phải là số nguyên";
  if (moneyError?.[2] === "must be a safe integer") return "Giá trị phải là số nguyên an toàn";
  return undefined;
}

export function translateError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return exactErrorTranslations[message] ?? translateDynamicError(message) ?? fallback;
}

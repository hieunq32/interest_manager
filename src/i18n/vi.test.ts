import { describe, expect, it } from "vitest";
import { vi, translateError } from "./vi";
import {
  calculationModelLabels,
  formatMoneyVnd,
  partialPeriodInterestModeLabels,
  rateUnitLabels,
} from "../lending/ui/lendingLabels";

describe("Vietnamese UI catalog", () => {
  it("contains the shared app and status labels", () => {
    expect(vi.appName).toBe("Quản lý tiền lãi");
    expect(vi.navigation.home).toBe("Trang chủ");
    expect(vi.status.overdue).toBe("Quá hạn");
  });

  it("translates every known UI and domain error without falling back to English", () => {
    const knownErrors = [
      ["Display name is required", "Tên hiển thị là bắt buộc"],
      ["Could not save borrower", "Không thể lưu người vay"],
      ["Could not save loan", "Không thể lưu khoản vay"],
      ["Could not preview schedule", "Không thể xem trước lịch thu"],
      ["Disbursement and maturity dates are required", "Vui lòng nhập ngày giải ngân và ngày tất toán"],
      ["Maturity date must be after disbursement date", "Ngày tất toán phải sau ngày giải ngân"],
      ["Rate must be a non-negative number", "Lãi suất phải là số không âm"],
      ["Reminder offset must be a non-negative whole number", "Số ngày nhắc trước phải là số nguyên không âm"],
      ["Reminder time must use HH:MM", "Giờ nhắc phải có dạng HH:MM"],
      ["Loan reminder offset must be a non-negative whole number", "Số ngày nhắc trước phải là số nguyên không âm"],
      ["Loan reminder time must use HH:MM", "Giờ nhắc phải có dạng HH:MM"],
      ["Could not save loan reminders", "Không thể lưu cài đặt nhắc hạn"],
      ["Could not clear loan reminder override", "Không thể lưu cài đặt nhắc hạn"],
      ["Could not save payment", "Không thể lưu khoản thu"],
      ["Received date is required", "Vui lòng nhập ngày thu"],
      ["At least one received amount must be positive", "Số tiền phải lớn hơn 0"],
      ["Could not save promise", "Không thể lưu lời hứa trả"],
      ["Promised date is required", "Vui lòng nhập ngày hứa trả"],
      ["Promise note is required", "Ghi chú hứa trả là bắt buộc"],
      ["Could not save revision", "Không thể lưu phiên bản lịch"],
      ["Effective, disbursement, and maturity dates are required", "Vui lòng nhập ngày áp dụng, ngày giải ngân và ngày tất toán"],
      ["Principal base must be a positive whole number", "Tiền gốc cơ sở phải là số nguyên dương"],
      ["A non-empty adjustment reason is required when changing the rate or rate unit", "Vui lòng nhập lý do điều chỉnh khi thay đổi lãi suất hoặc đơn vị lãi suất"],
      ["effectiveDate must not be before disbursementDate", "Ngày áp dụng không được trước ngày giải ngân"],
      ["effectiveDate must not move backwards from the previous version", "Ngày áp dụng không được lùi so với phiên bản trước"],
      ["effectiveDate must be before maturityDate", "Ngày áp dụng phải trước ngày tất toán"],
      ["maturityDate must be after disbursementDate", "Ngày tất toán phải sau ngày giải ngân"],
      ["Principal must be a positive whole number", "Tiền gốc phải là số nguyên dương"],
      ["Monthly due day must be between 1 and 31", "Ngày thu hàng tháng phải từ 1 đến 31"],
      ["Invalid date-only value: 2026-02-30", "Giá trị ngày không hợp lệ: 2026-02-30"],
      ["enabled must be a boolean", "Trạng thái bật nhắc hạn phải là giá trị đúng hoặc sai"],
      ["offsetDays must be a non-negative integer", "Số ngày nhắc trước phải là số nguyên không âm"],
      ["time must use HH:MM in 24-hour time", "Giờ nhắc phải có dạng HH:MM trong hệ 24 giờ"],
      ["dtstampUtc must be an ISO UTC timestamp", "Dấu thời gian UTC phải có dạng ISO"],
      ["dtstampUtc must be a valid ISO UTC timestamp", "Dấu thời gian UTC phải là thời điểm ISO hợp lệ"],
      ["reminderOffsetDays must be a non-negative integer", "Số ngày nhắc trước phải là số nguyên không âm"],
      ["month must be between 1 and 12", "Tháng phải từ 1 đến 12"],
      ["due day must be between 1 and 31", "Ngày đến hạn phải từ 1 đến 31"],
      ["year must be between 0 and 9999", "Năm phải từ 0 đến 9999"],
      ["end date cannot be before start date", "Ngày kết thúc không được trước ngày bắt đầu"],
      ["rateValue must be a finite number", "Giá trị lãi suất phải là số hữu hạn"],
      ["rateValue must be non-negative", "Lãi suất phải là số không âm"],
      ["period must span at least one calendar day", "Kỳ tính lãi phải kéo dài ít nhất một ngày dương lịch"],
      ["rateUnit must be monthly or daily", "Đơn vị lãi suất phải là theo tháng hoặc theo ngày"],
      ["partialPeriodInterestMode is invalid", "Cách tính lãi kỳ không trọn tháng không hợp lệ"],
      ["money must be a finite number", "Số tiền phải là số hữu hạn"],
      ["money must be non-negative", "Số tiền không được âm"],
      ["money must round to a safe integer", "Số tiền phải làm tròn thành số nguyên an toàn"],
      ["Payment amount must be an integer", "Giá trị phải là số nguyên"],
      ["Invalid backup file", "Tệp sao lưu không hợp lệ"],
      ["Unsupported backup version", "Phiên bản sao lưu không được hỗ trợ"],
      ["Invalid backup payload", "Nội dung sao lưu không hợp lệ"],
      ["Invalid backup records", "Bản ghi sao lưu không hợp lệ"],
      ["Unable to decrypt backup payload", "Không thể giải mã nội dung sao lưu"],
      ["IndexedDB is unavailable", "Bộ nhớ cục bộ không khả dụng"],
    ] as const;

    for (const [message, expected] of knownErrors) {
      expect(translateError(new Error(message), vi.errors.unknown)).toBe(expected);
    }

    expect(translateError(new Error("Unknown error"), "Thông báo dự phòng")).toBe("Thông báo dự phòng");
  });

  it("preserves the supplied fallback for unknown validation-shaped errors", () => {
    expect(translateError(new Error("Unknown field must be non-negative"), "Caller fallback")).toBe("Caller fallback");
  });
});

describe("Vietnamese lending labels", () => {
  it("translates calculation, rate, and partial-period labels", () => {
    expect(calculationModelLabels["interest-only-final-principal"]).toBe("Chỉ thu lãi, thu gốc khi tất toán");
    expect(calculationModelLabels["equal-principal-flat-interest"]).toBe("Gốc đều, lãi phẳng");
    expect(rateUnitLabels.monthly).toBe("Theo tháng");
    expect(rateUnitLabels.daily).toBe("Theo ngày");
    expect(partialPeriodInterestModeLabels["full-period"]).toBe("Đủ kỳ");
    expect(partialPeriodInterestModeLabels["calendar-day-prorated"]).toBe("Tính theo ngày thực tế");
  });

  it("formats integer VND values for Vietnamese users", () => {
    expect(formatMoneyVnd(1_000_000)).toBe("1.000.000 đ");
    expect(formatMoneyVnd(0)).toBe("0 đ");
  });
});

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

  it("translates known validation errors and preserves Vietnamese fallbacks", () => {
    expect(translateError(new Error("Display name is required"), vi.errors.unknown)).toBe("Tên hiển thị là bắt buộc");
    expect(translateError(new Error("Principal must be a positive whole number"), vi.errors.unknown)).toBe("Tiền gốc phải là số nguyên dương");
    expect(translateError(new Error("Unknown error"), "Thông báo dự phòng")).toBe("Thông báo dự phòng");
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

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEncryptedBackup } from "../backup/backupService";
import type { Borrower, Loan, LoanLifecycleEvent, PaymentAdjustment, PaymentTransaction, PromiseToPay, ReminderSettings, ScheduleEntry, ScheduleVersion } from "../lending/domain/types";
import type { GenericRecord } from "../backup/types";
import { IndexedDbLendingRepository } from "../lending/storage/lendingRepository";
import { IndexedDbRecordStore } from "../storage/indexedDbRecordStore";
import { App } from "./App";

let dbCounter = 0;

function nextDbName(): string {
  dbCounter += 1;
  return `interest-manager-ui-test-${dbCounter}`;
}

describe("App", () => {
  it("uses the actionable dashboard as the first route", async () => {
    render(<App dbName={nextDbName()} />);

    expect(screen.getByRole("heading", { name: "Quản lý tiền lãi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trang chủ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cài đặt" })).toBeInTheDocument();
    expect(screen.getByText("Đang online")).toBeInTheDocument();
    expect(screen.getByText("Sẵn sàng")).toBeInTheDocument();
    expect(await screen.findByText("Bộ nhớ sẵn sàng")).toBeInTheDocument();
    expect(screen.getByText("0 bản ghi")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.getByText("0 khoản vay đang hoạt động")).toBeInTheDocument();
  });

  it("updates the connection status when the browser goes offline and online", async () => {
    render(<App dbName={nextDbName()} />);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(await screen.findByText("Đang offline")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(await screen.findByText("Đang online")).toBeInTheDocument();
  });

  it("renders unavailable storage and plural record counts in Vietnamese", async () => {
    const getHealth = vi.spyOn(IndexedDbRecordStore.prototype, "getHealth").mockResolvedValue({
      available: false,
      recordCount: 2,
      message: "Storage unavailable",
    });

    try {
      render(<App dbName={nextDbName()} />);

      expect(screen.getByText("Đang kiểm tra bộ nhớ")).toBeInTheDocument();
      expect(await screen.findByText("Bộ nhớ không khả dụng")).toBeInTheDocument();
      expect(screen.getByText("2 bản ghi")).toBeInTheDocument();
    } finally {
      getHealth.mockRestore();
    }
  });

  it("renders Vietnamese PWA and borrower save status messages", async () => {
    const user = userEvent.setup();
    render(<App dbName={nextDbName()} />);

    act(() => {
      window.dispatchEvent(new CustomEvent("interest-manager:pwa-error", { detail: {} }));
    });
    expect(await screen.findByText("Bộ nhớ đệm ngoại tuyến không khả dụng")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thêm người vay" }));
    await user.type(screen.getByLabelText("Tên hiển thị"), "Tran Thi B");
    await user.click(screen.getByRole("button", { name: "Lưu người vay" }));
    expect(await screen.findByText("Đã lưu người vay")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sửa người vay" }));
    await user.click(screen.getByRole("button", { name: "Lưu trữ người vay" }));
    expect(await screen.findByText("Đã lưu trữ người vay")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Trang chủ" }));
    await screen.findByRole("button", { name: "Thêm người vay" });
  });

  it("uses the generic Vietnamese error for an unknown shell message", async () => {
    render(<App dbName={nextDbName()} />);

    act(() => {
      window.dispatchEvent(new CustomEvent("interest-manager:pwa-error", { detail: { message: "Unexpected storage failure" } }));
    });

    expect(await screen.findByText("Đã xảy ra lỗi. Vui lòng thử lại.")).toBeInTheDocument();
  });

  it("creates a borrower and navigates to its persisted detail route", async () => {
    const user = userEvent.setup();
    render(<App dbName={nextDbName()} />);

    await user.click(screen.getByRole("button", { name: "Thêm người vay" }));
    await user.type(screen.getByLabelText("Tên hiển thị"), "Tran Thi B");
    await user.click(screen.getByRole("button", { name: "Lưu người vay" }));

    expect(await screen.findByRole("heading", { name: "Tran Thi B" })).toBeInTheDocument();
    expect(window.location.hash).toMatch(/^#\/borrowers\//);
  });

  it("downloads an encrypted backup when a passphrase is provided", async () => {
    const user = userEvent.setup();
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;

    render(<App dbName={nextDbName()} />);

    await user.click(screen.getByRole("link", { name: "Cài đặt" }));

    const createElement = vi.spyOn(document, "createElement");
    createElement.mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === "a") {
        createdAnchor = element as HTMLAnchorElement;
        vi.spyOn(createdAnchor, "click").mockImplementation(() => undefined);
      }
      return element;
    }) as typeof document.createElement);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:backup"),
      revokeObjectURL: vi.fn(),
    });

    await user.type(screen.getByLabelText("Mật khẩu sao lưu"), "safe passphrase");
    await user.click(screen.getByRole("button", { name: "Sao lưu" }));

    await waitFor(() => expect(createdAnchor?.click).toHaveBeenCalledTimes(1));
    expect(createdAnchor?.download).toMatch(/^interest-manager-backup-\d{4}-\d{2}-\d{2}\.json$/);
    createElement.mockRestore();
    vi.unstubAllGlobals();
  });

  it("restores a backup only after replacement confirmation", async () => {
    const user = userEvent.setup();
    const restoredRecord: GenericRecord = {
      id: "restored-record",
      type: "lending.borrower",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
      data: {
        id: "restored-record",
        displayName: "Restored borrower",
        status: "active",
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      },
    };
    const backup = await createEncryptedBackup([restoredRecord], "safe passphrase", { iterations: 1000 });
    const file = new File([JSON.stringify(backup)], "backup.json", { type: "application/json" });
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);

    render(<App dbName={nextDbName()} />);

    await user.click(screen.getByRole("link", { name: "Cài đặt" }));

    await user.type(screen.getByLabelText("Mật khẩu khôi phục"), "safe passphrase");
    await user.upload(screen.getByLabelText("Tệp sao lưu"), file);

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("Thay thế các bản ghi cục bộ bằng bản sao lưu này?"));
    await waitFor(() => expect(screen.getByText("1 bản ghi")).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it("resets lending data only after confirmation without clearing unrelated shared records", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const store = new IndexedDbRecordStore(dbName);
    const repository = new IndexedDbLendingRepository(store);
    const history = lendingHistory();
    await saveLendingHistory(repository, history);
    await store.upsertRecord({
      id: "system-record",
      type: "system.smoke",
      createdAt: history.borrower.createdAt,
      updatedAt: history.borrower.updatedAt,
      data: { retained: true },
    });
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);

    render(<App dbName={dbName} />);

    await user.click(screen.getByRole("link", { name: "Cài đặt" }));
    await user.click(screen.getByRole("button", { name: "Xóa dữ liệu cho vay" }));

    expect(confirm).toHaveBeenCalledWith("Xóa toàn bộ dữ liệu cho vay cục bộ?");
    await waitFor(() => expect(screen.getByText("Đã xóa dữ liệu cho vay cục bộ")).toBeInTheDocument());
    await expect(repository.listAllDomainRecords()).resolves.toEqual([]);
    await expect(store.listRecordsByType("system.smoke")).resolves.toEqual([
      expect.objectContaining({ data: { retained: true } }),
    ]);
    vi.unstubAllGlobals();
  });

  it("persists global reminder settings across an App reload", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const first = render(<App dbName={dbName} />);

    await user.click(screen.getByRole("link", { name: "Cài đặt" }));
    expect(screen.getByLabelText("Bật nhắc hạn")).toBeChecked();
    expect(screen.getByLabelText("Nhắc trước (ngày)")).toHaveValue("1");
    expect(screen.getByLabelText("Giờ nhắc")).toHaveValue("08:00");
    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.type(screen.getByLabelText("Nhắc trước (ngày)"), "2");
    await user.clear(screen.getByLabelText("Giờ nhắc"));
    await user.type(screen.getByLabelText("Giờ nhắc"), "09:30");
    await user.click(screen.getByRole("button", { name: "Lưu cài đặt nhắc hạn" }));
    first.unmount();

    render(<App dbName={dbName} />);
    await user.click(screen.getByRole("link", { name: "Cài đặt" }));
    await waitFor(() => expect(screen.getByLabelText("Nhắc trước (ngày)")).toHaveValue("2"));
    expect(screen.getByLabelText("Giờ nhắc")).toHaveValue("09:30");
  });

  it("hides calendar export controls for settled loans", async () => {
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const { borrower, loan, version, entry } = lendingHistory();
    await repository.saveBorrower(borrower);
    await repository.saveLoanBundle({ loan: { ...loan, status: "settled" }, version, entries: [entry] });
    window.location.hash = `#/loans/${loan.id}`;

    render(<App dbName={dbName} />);
    await screen.findByRole("heading", { name: "Chi tiết khoản vay" });
    expect(screen.queryByRole("button", { name: "Xuất lịch Calendar" })).not.toBeInTheDocument();
  });

  it("backs up and restores typed lending records without replacing unrelated shared records", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const store = new IndexedDbRecordStore(dbName);
    const repository = new IndexedDbLendingRepository(store);
    const history = lendingHistory();
    await saveLendingHistory(repository, history);
    const expectedDomainRecords = await repository.listAllDomainRecords();
    const sharedRecord: GenericRecord = {
      id: "system-record",
      type: "system.smoke",
      createdAt: history.borrower.createdAt,
      updatedAt: history.borrower.updatedAt,
      data: { origin: "before-export" },
    };
    await store.upsertRecord(sharedRecord);
    const originalCreateElement = document.createElement.bind(document);
    let backupBlob: Blob | undefined;
    const createElement = vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === "a") {
        vi.spyOn(element, "click").mockImplementation(() => undefined);
      }
      return element;
    }) as typeof document.createElement);
    vi.stubGlobal("URL", { createObjectURL: vi.fn((blob: Blob) => {
      backupBlob = blob;
      return "blob:backup";
    }), revokeObjectURL: vi.fn() });
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    render(<App dbName={dbName} />);

    await user.click(screen.getByRole("link", { name: "Cài đặt" }));
    await user.type(screen.getByLabelText("Mật khẩu sao lưu"), "safe passphrase");
    await user.click(screen.getByRole("button", { name: "Sao lưu" }));
    await waitFor(() => expect(backupBlob).toBeDefined());
    const backupFile = new File([await backupBlob!.text()], "backup.json", { type: "application/json" });
    await repository.replaceAllDomainRecords([]);
    await store.upsertRecord({ ...sharedRecord, updatedAt: "2026-07-29T00:00:00.000Z", data: { origin: "after-export" } });

    await user.type(screen.getByLabelText("Mật khẩu khôi phục"), "safe passphrase");
    await user.upload(screen.getByLabelText("Tệp sao lưu"), backupFile);

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("Thay thế các bản ghi cục bộ bằng bản sao lưu này?"));
    await expect(repository.listAllDomainRecords()).resolves.toEqual(expectedDomainRecords);
    await expect(store.listRecordsByType("system.smoke")).resolves.toEqual([expect.objectContaining({ data: { origin: "after-export" } })]);
    createElement.mockRestore();
    vi.unstubAllGlobals();
  });

  it("recovers adjusted, voided, and reopened loan history from an encrypted UI backup", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const store = new IndexedDbRecordStore(dbName);
    const repository = new IndexedDbLendingRepository(store);
    const history = await saveAuditedLendingHistory(repository);
    const originalCreateElement = document.createElement.bind(document);
    let backupBlob: Blob | undefined;
    const createElement = vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === "a") {
        vi.spyOn(element, "click").mockImplementation(() => undefined);
      }
      return element;
    }) as typeof document.createElement);
    const confirm = vi.fn(() => true);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => {
        backupBlob = blob;
        return "blob:backup";
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("confirm", confirm);

    try {
      window.location.hash = "#/settings";
      render(<App dbName={dbName} />);
      await screen.findByRole("heading", { name: "Sao lưu" });
      await user.type(screen.getByLabelText("Mật khẩu sao lưu"), "safe passphrase");
      await user.click(screen.getByRole("button", { name: "Sao lưu" }));
      await waitFor(() => expect(backupBlob).toBeDefined());
      const backupText = await backupBlob!.text();
      expect(backupText).not.toContain(history.editAdjustment.reason);
      expect(backupText).not.toContain(history.reopenEvent.reason);
      const backupFile = new File([backupText], "backup.json", { type: "application/json" });

      await user.click(screen.getByRole("button", { name: "Xóa dữ liệu cho vay" }));
      await waitFor(() => expect(confirm).toHaveBeenNthCalledWith(1, "Xóa toàn bộ dữ liệu cho vay cục bộ?"));
      await expect(repository.listAllDomainRecords()).resolves.toEqual([]);

      await user.type(screen.getByLabelText("Mật khẩu khôi phục"), "safe passphrase");
      await user.upload(screen.getByLabelText("Tệp sao lưu"), backupFile);
      await waitFor(() => expect(confirm).toHaveBeenNthCalledWith(2, "Thay thế các bản ghi cục bộ bằng bản sao lưu này?"));
      await expect(repository.listBorrowers()).resolves.toEqual([history.borrower]);
      await expect(repository.listLoans(history.borrower.id)).resolves.toEqual([history.loan]);
      await expect(repository.listPaymentHistory(history.loan.id)).resolves.toEqual([
        history.finalPayment,
        history.originalPayment,
        history.replacementPayment,
      ]);
      await expect(repository.listPaymentAdjustments(history.loan.id)).resolves.toEqual([
        history.editAdjustment,
        history.voidAdjustment,
      ]);
      await expect(repository.listLoanLifecycleEvents(history.loan.id)).resolves.toEqual([
        history.settlementEvent,
        history.reopenEvent,
      ]);

      act(() => {
        window.location.hash = `#/loans/${history.loan.id}`;
        window.dispatchEvent(new Event("hashchange"));
      });
      await screen.findByRole("heading", { name: "Chi tiết khoản vay" });
      for (const historyEntry of screen.getAllByText("Lịch sử điều chỉnh")) {
        await user.click(historyEntry);
      }
      expect(screen.getByText(history.editAdjustment.reason)).toBeInTheDocument();
      expect(screen.getByText(history.voidAdjustment.reason)).toBeInTheDocument();
      expect(screen.getByText("Đã tất toán: 2026-07-15")).toBeInTheDocument();
      expect(screen.getByText("Đã mở lại: 2026-07-16 - Correction needs another review")).toBeInTheDocument();
    } finally {
      createElement.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("loads borrower records after a hash-route reload", async () => {
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const borrower = {
      id: "borrower / one",
      displayName: "Le Van C",
      status: "active" as const,
      createdAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-20T00:00:00.000Z",
    };
    await repository.saveBorrower(borrower);
    window.location.hash = "#/borrowers/borrower%20%2F%20one";

    const first = render(<App dbName={dbName} />);
    expect(await screen.findByRole("heading", { name: "Le Van C" })).toBeInTheDocument();
    first.unmount();

    render(<App dbName={dbName} />);
    expect(await screen.findByRole("heading", { name: "Le Van C" })).toBeInTheDocument();
  });

  it("saves a loan, its first version, and generated entries from the confirmed preview", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const borrower = {
      id: "borrower-1",
      displayName: "Pham Thi D",
      status: "active" as const,
      createdAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-20T00:00:00.000Z",
    };
    await repository.saveBorrower(borrower);
    const saveLoanBundle = vi.spyOn(IndexedDbLendingRepository.prototype, "saveLoanBundle");
    const saveLoan = vi.spyOn(IndexedDbLendingRepository.prototype, "saveLoan");
    const saveScheduleVersion = vi.spyOn(IndexedDbLendingRepository.prototype, "saveScheduleVersion");
    const saveScheduleEntries = vi.spyOn(IndexedDbLendingRepository.prototype, "saveScheduleEntries");
    window.location.hash = "#/borrowers/borrower-1";
    render(<App dbName={dbName} />);

    await screen.findByRole("heading", { name: "Pham Thi D" });
    await user.click(screen.getByRole("button", { name: "Thêm khoản vay" }));
    await user.type(screen.getByLabelText("Tiền gốc (đ)"), "10000000");
    await user.type(screen.getByLabelText("Ngày giải ngân"), "2026-06-20");
    await user.selectOptions(screen.getByLabelText("Mô hình tính"), "equal-principal-flat-interest");
    await user.clear(screen.getByLabelText("Ngày thu hàng tháng"));
    await user.type(screen.getByLabelText("Ngày thu hàng tháng"), "5");
    await user.type(screen.getByLabelText("Ngày tất toán"), "2026-12-15");
    await user.type(screen.getByLabelText("Lãi suất (%)"), "2");
    await user.click(screen.getByRole("button", { name: "Xem trước lịch thu" }));
    await user.click(await screen.findByRole("button", { name: "Xác nhận và lưu khoản vay" }));

    expect(await screen.findByRole("heading", { name: "Chi tiết khoản vay" })).toBeInTheDocument();
    const [loan] = await repository.listLoans(borrower.id);
    const [version] = await repository.listScheduleVersions(loan.id);
    expect(loan.defaultScheduleVersionId).toBe(version.id);
    await expect(repository.listScheduleEntries(version.id)).resolves.toHaveLength(6);
    expect(saveLoanBundle).toHaveBeenCalledTimes(1);
    expect(saveLoan).not.toHaveBeenCalled();
    expect(saveScheduleVersion).not.toHaveBeenCalled();
    expect(saveScheduleEntries).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("uses the revision boundary when calculating dashboard balances", async () => {
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const history = lendingHistory();
    const firstVersion = { ...history.version, id: "dashboard-version-1" };
    const activeVersion: ScheduleVersion = {
      ...firstVersion,
      id: "dashboard-version-2",
      versionNumber: 2,
      effectiveDate: "2026-09-01",
      createdAt: history.loan.updatedAt,
    };
    const oldDue: ScheduleEntry = {
      ...history.entry,
      id: "dashboard-old-due",
      scheduleVersionId: firstVersion.id,
      dueDate: "2026-08-05",
      expectedPrincipal: 1_000_000,
      expectedInterest: 200_000,
    };
    const oldFuture: ScheduleEntry = {
      ...history.entry,
      id: "dashboard-old-future",
      scheduleVersionId: firstVersion.id,
      dueDate: "2026-09-05",
      expectedPrincipal: 5_000_000,
      expectedInterest: 500_000,
    };
    const activeEntry: ScheduleEntry = {
      ...history.entry,
      id: "dashboard-active",
      scheduleVersionId: activeVersion.id,
      dueDate: "2026-10-05",
      expectedPrincipal: 1_000_000,
      expectedInterest: 200_000,
    };
    const originalLoan = { ...history.loan, defaultScheduleVersionId: firstVersion.id };
    const revisedLoan = { ...originalLoan, defaultScheduleVersionId: activeVersion.id };
    await repository.saveBorrower(history.borrower);
    await repository.saveLoanBundle({
      loan: originalLoan,
      version: firstVersion,
      entries: [oldDue, oldFuture],
    });
    await repository.saveLoanBundle({
      loan: revisedLoan,
      version: activeVersion,
      entries: [activeEntry],
    });
    await repository.savePayment({
      ...history.payment,
      scheduleEntryId: oldDue.id,
      principalAmount: 500_000,
      interestAmount: 200_000,
    });
    window.location.hash = "#/";

    render(<App dbName={dbName} />);

    expect(await screen.findByRole("heading", { name: "Tổng quan" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Gốc còn phải thu: 1.500.000 đ")).toBeInTheDocument());
    expect(screen.getByText("Lãi còn phải thu: 200.000 đ")).toBeInTheDocument();
  });

  it("persists a payment and a revision from the loan detail workflow", async () => {
    const user = userEvent.setup();
    const onCalendarExport = vi.fn().mockResolvedValue(undefined);
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const borrower = {
      id: "borrower-detail-1",
      displayName: "Do Thi E",
      status: "active" as const,
      createdAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-20T00:00:00.000Z",
    };
    const loan: Loan = {
      id: "loan-detail-1",
      borrowerId: borrower.id,
      calculationModel: "equal-principal-flat-interest",
      originalPrincipal: 1_000_000,
      disbursementDate: "2026-06-20",
      monthlyDueDay: 5,
      maturityDate: "2026-12-15",
      rateValue: 0.02,
      rateUnit: "monthly",
      partialPeriodInterestMode: "full-period",
      defaultScheduleVersionId: "version-detail-1",
      status: "active",
      createdAt: borrower.createdAt,
      updatedAt: borrower.updatedAt,
    };
    const version: ScheduleVersion = {
      id: loan.defaultScheduleVersionId,
      loanId: loan.id,
      versionNumber: 1,
      effectiveDate: loan.disbursementDate,
      calculationModel: loan.calculationModel,
      principalBase: loan.originalPrincipal,
      disbursementDate: loan.disbursementDate,
      monthlyDueDay: loan.monthlyDueDay,
      maturityDate: loan.maturityDate,
      rateValue: loan.rateValue,
      rateUnit: loan.rateUnit,
      partialPeriodInterestMode: loan.partialPeriodInterestMode,
      createdAt: loan.createdAt,
    };
    const entry: ScheduleEntry = {
      id: "entry-detail-1",
      scheduleVersionId: version.id,
      periodStart: "2026-06-20",
      dueDate: "2026-08-05",
      expectedPrincipal: 1_000_000,
      expectedInterest: 20_000,
      status: "upcoming",
      createdAt: version.createdAt,
      updatedAt: version.createdAt,
    };
    await repository.saveBorrower(borrower);
    await repository.saveLoanBundle({ loan, version, entries: [entry] });
    window.location.hash = "#/loans/loan-detail-1";
    render(<App dbName={dbName} onCalendarExport={onCalendarExport} />);

    await screen.findByRole("heading", { name: "Chi tiết khoản vay" });
    await user.click(screen.getByRole("button", { name: "Xuất lịch Calendar" }));
    await screen.findByText("Đã cập nhật trạng thái lịch Calendar");
    expect(onCalendarExport).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("BEGIN:VCALENDAR"),
      loanId: loan.id,
      scheduleVersionId: version.id,
    }));
    expect(await repository.listLoans(borrower.id)).toEqual([expect.objectContaining({ calendarExportVersionId: version.id })]);
    await user.click(screen.getByRole("button", { name: "Ghi nhận khoản thu" }));
    await user.type(screen.getByLabelText("Ngày thu"), "2026-07-29");
    await user.type(screen.getByLabelText("Gốc đã thu (đ)"), "1000000");
    await user.type(screen.getByLabelText("Lãi đã thu (đ)"), "20000");
    await user.click(screen.getByRole("button", { name: "Lưu khoản thu" }));
    await screen.findByText("Đã ghi nhận khoản thu");
    expect(await repository.listPayments(loan.id)).toEqual([expect.objectContaining({ principalAmount: 1_000_000, interestAmount: 20_000 })]);
    await user.click(screen.getByRole("button", { name: "Xuất lịch Calendar" }));
    await waitFor(() => expect(onCalendarExport).toHaveBeenCalledTimes(2));
    expect(onCalendarExport.mock.calls[1][0].content).not.toContain("BEGIN:VEVENT");

    const saveLoanBundle = vi.spyOn(IndexedDbLendingRepository.prototype, "saveLoanBundle");
    const saveLoan = vi.spyOn(IndexedDbLendingRepository.prototype, "saveLoan");
    const saveScheduleVersion = vi.spyOn(IndexedDbLendingRepository.prototype, "saveScheduleVersion");
    const saveScheduleEntries = vi.spyOn(IndexedDbLendingRepository.prototype, "saveScheduleEntries");
    await user.click(screen.getByRole("button", { name: "Điều chỉnh lịch thu" }));
    await user.clear(screen.getByLabelText("Ngày áp dụng"));
    await user.type(screen.getByLabelText("Ngày áp dụng"), "2026-08-01");
    const revisionMaturityDate = screen.getAllByLabelText<HTMLInputElement>("Ngày tất toán").find((input) => input.value === "2026-12-15");
    expect(revisionMaturityDate).toBeDefined();
    await user.clear(revisionMaturityDate!);
    await user.type(revisionMaturityDate!, "2027-01-15");
    await user.click(screen.getByRole("button", { name: "Lưu phiên bản lịch mới" }));
    await screen.findByText("Đã điều chỉnh lịch thu; lịch Calendar cần xuất lại");
    await waitFor(async () => expect(await repository.listScheduleVersions(loan.id)).toHaveLength(2));
    const [updatedLoan] = await repository.listLoans(borrower.id);
    expect(updatedLoan.defaultScheduleVersionId).not.toBe(version.id);
    expect(updatedLoan.calendarExportVersionId).toBe(version.id);
    expect(await repository.listScheduleEntries(version.id)).toEqual([entry]);
    expect(screen.getByText("Gốc còn phải thu: 1.000.000 đ")).toBeInTheDocument();
    expect(saveLoanBundle).toHaveBeenCalledTimes(1);
    expect(saveLoan).not.toHaveBeenCalled();
    expect(saveScheduleVersion).not.toHaveBeenCalled();
    expect(saveScheduleEntries).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("exports retained historical promises and excludes them after the linked entry is paid", async () => {
    const user = userEvent.setup();
    const onCalendarExport = vi.fn().mockResolvedValue(undefined);
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const history = lendingHistory();
    const oldVersion: ScheduleVersion = {
      ...history.version,
      id: "calendar-version-1",
      maturityDate: "2999-12-15",
    };
    const activeVersion: ScheduleVersion = {
      ...oldVersion,
      id: "calendar-version-2",
      versionNumber: 2,
      effectiveDate: "2999-08-01",
      createdAt: history.loan.updatedAt,
    };
    const retainedEntry: ScheduleEntry = {
      ...history.entry,
      id: "calendar-retained-entry",
      scheduleVersionId: oldVersion.id,
      periodStart: "2999-06-30",
      dueDate: "2999-07-31",
      expectedPrincipal: 1_000_000,
      expectedInterest: 20_000,
    };
    const activeEntry: ScheduleEntry = {
      ...history.entry,
      id: "calendar-active-entry",
      scheduleVersionId: activeVersion.id,
      periodStart: activeVersion.effectiveDate,
      dueDate: "2999-09-05",
    };
    const originalLoan: Loan = {
      ...history.loan,
      defaultScheduleVersionId: oldVersion.id,
      maturityDate: oldVersion.maturityDate,
    };
    const revisedLoan: Loan = {
      ...originalLoan,
      defaultScheduleVersionId: activeVersion.id,
    };
    const historicalPromise: PromiseToPay = {
      ...history.promise,
      id: "calendar-historical-promise",
      loanId: revisedLoan.id,
      scheduleEntryId: retainedEntry.id,
      promisedDate: "2999-08-10",
      note: "Historical entry promise",
    };
    await repository.saveBorrower(history.borrower);
    await repository.saveLoanBundle({ loan: originalLoan, version: oldVersion, entries: [retainedEntry] });
    await repository.saveLoanBundle({ loan: revisedLoan, version: activeVersion, entries: [activeEntry] });
    await repository.savePromise(historicalPromise);
    window.location.hash = `#/loans/${revisedLoan.id}`;

    const first = render(<App dbName={dbName} onCalendarExport={onCalendarExport} />);
    await screen.findByRole("heading", { name: "Chi tiết khoản vay" });
    await user.click(screen.getByRole("button", { name: "Xuất lịch Calendar" }));
    await waitFor(() => expect(onCalendarExport).toHaveBeenCalledTimes(1));
    expect(onCalendarExport.mock.calls[0][0].content).toContain("Promise: calendar-historical-promise");
    first.unmount();

    await repository.savePayment({
      ...history.payment,
      id: "calendar-historical-payment",
      loanId: revisedLoan.id,
      scheduleEntryId: retainedEntry.id,
      principalAmount: retainedEntry.expectedPrincipal,
      interestAmount: retainedEntry.expectedInterest,
    });
    await expect(repository.listLoans(revisedLoan.borrowerId)).resolves.toEqual([
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
    ]);

    render(<App dbName={dbName} onCalendarExport={onCalendarExport} />);
    await screen.findByRole("heading", { name: "Chi tiết khoản vay" });
    await user.click(screen.getByRole("button", { name: "Xuất lịch Calendar" }));
    await waitFor(() => expect(onCalendarExport).toHaveBeenCalledTimes(2));
    expect(onCalendarExport.mock.calls[1][0].content).not.toContain(retainedEntry.id);
    expect(onCalendarExport.mock.calls[1][0].content).not.toContain(historicalPromise.id);
  });

  it("invalidates exported calendars when global reminder settings change", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const history = lendingHistory();
    await repository.saveLoan({
      ...history.loan,
      calendarExportVersionId: history.loan.defaultScheduleVersionId,
    });
    window.location.hash = "#/settings";
    render(<App dbName={dbName} />);

    await screen.findByRole("heading", { name: "Nhắc hạn mặc định" });
    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.type(screen.getByLabelText("Nhắc trước (ngày)"), "2");
    await user.click(screen.getByRole("button", { name: "Lưu cài đặt nhắc hạn" }));

    await waitFor(async () => expect(await repository.listLoans()).toEqual([
      expect.not.objectContaining({ calendarExportVersionId: expect.any(String) }),
    ]));
  });

  it("persists and clears a loan reminder override from loan detail", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const history = lendingHistory();
    await repository.saveBorrower(history.borrower);
    await repository.saveLoanBundle({
      loan: {
        ...history.loan,
        calendarExportVersionId: history.loan.defaultScheduleVersionId,
      },
      version: history.version,
      entries: [history.entry],
    });
    window.location.hash = `#/loans/${history.loan.id}`;
    render(<App dbName={dbName} />);

    await screen.findByRole("heading", { name: "Chi tiết khoản vay" });
    await user.click(screen.getByLabelText("Dùng cấu hình nhắc riêng"));
    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.type(screen.getByLabelText("Nhắc trước (ngày)"), "4");
    await user.clear(screen.getByLabelText("Giờ nhắc"));
    await user.type(screen.getByLabelText("Giờ nhắc"), "10:15");
    await user.click(screen.getByRole("button", { name: "Lưu nhắc hạn khoản vay" }));

    await waitFor(async () => expect(await repository.listLoans()).toEqual([
      expect.objectContaining({
        reminderOverride: { enabled: true, offsetDays: 4, time: "10:15" },
      }),
    ]));
    expect((await repository.listLoans())[0]).not.toHaveProperty("calendarExportVersionId");

    await user.click(screen.getByRole("button", { name: "Xóa cấu hình nhắc riêng" }));
    await waitFor(async () => expect((await repository.listLoans())[0]).not.toHaveProperty("reminderOverride"));
  });

  it("persists payment corrections and cancellations with their audit records", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const history = lendingHistory();
    await saveLendingHistory(repository, history);
    window.location.hash = `#/loans/${history.loan.id}`;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App dbName={dbName} />);

    await screen.findByRole("heading", { name: "Chi tiết khoản vay" });
    await user.click(screen.getByRole("button", { name: "Sửa giao dịch" }));
    await user.clear(screen.getByLabelText("Gốc đã thu (đ)"));
    await user.type(screen.getByLabelText("Gốc đã thu (đ)"), "120000");
    await user.type(screen.getByLabelText("Lý do điều chỉnh"), "Corrected receipt");
    await user.click(screen.getByRole("button", { name: "Lưu điều chỉnh" }));

    await waitFor(async () => expect(await repository.listPaymentAdjustments(history.loan.id)).toEqual([
      expect.objectContaining({ action: "edit", reason: "Corrected receipt", paymentId: history.payment.id }),
    ]));
    const replacement = (await repository.listPayments(history.loan.id))[0];
    expect(replacement).toMatchObject({ principalAmount: 120_000, status: "active" });
    expect(await repository.listPaymentHistory(history.loan.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: history.payment.id, status: "adjusted" }),
      expect.objectContaining({ id: replacement.id, status: "active" }),
    ]));

    await user.click(screen.getByRole("button", { name: "Hủy giao dịch" }));
    await user.type(screen.getByLabelText("Lý do điều chỉnh"), "Duplicate receipt");
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy giao dịch" }));

    await waitFor(async () => expect(await repository.listPaymentAdjustments(history.loan.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "void", reason: "Duplicate receipt", paymentId: replacement.id }),
    ])));
    await expect(repository.listPayments(history.loan.id)).resolves.toEqual([]);
    expect(confirm).toHaveBeenCalledWith("Xác nhận hủy giao dịch");
    confirm.mockRestore();
  });

  it("settles an eligible loan and reopens it with an auditable reason", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const history = lendingHistory();
    await repository.saveBorrower(history.borrower);
    await repository.saveLoanBundle({ loan: history.loan, version: history.version, entries: [history.entry] });
    await repository.savePayment({
      ...history.payment,
      principalAmount: history.entry.expectedPrincipal,
      interestAmount: history.entry.expectedInterest,
    });
    window.location.hash = `#/loans/${history.loan.id}`;
    render(<App dbName={dbName} />);

    await screen.findByRole("heading", { name: "Chi tiết khoản vay" });
    await user.clear(screen.getByLabelText("Ngày tất toán"));
    await user.type(screen.getByLabelText("Ngày tất toán"), "2026-07-15");
    await user.click(screen.getByRole("button", { name: "Xác nhận tất toán" }));
    await screen.findByText("Đã tất toán khoản vay");
    await expect(repository.listLoans(history.borrower.id)).resolves.toEqual([
      expect.objectContaining({ status: "settled", settledAt: "2026-07-15" }),
    ]);
    await expect(repository.listLoanLifecycleEvents(history.loan.id)).resolves.toEqual([
      expect.objectContaining({ action: "settled", effectiveDate: "2026-07-15" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Mở lại khoản vay" }));
    await user.type(screen.getByLabelText("Lý do mở lại khoản vay"), "Payment correction required");
    await user.click(screen.getByRole("button", { name: "Xác nhận mở lại" }));
    await screen.findByText("Đã mở lại khoản vay");
    await expect(repository.listLoans(history.borrower.id)).resolves.toEqual([
      expect.not.objectContaining({ settledAt: expect.any(String) }),
    ]);
    await expect(repository.listLoanLifecycleEvents(history.loan.id)).resolves.toEqual([
      expect.objectContaining({ action: "settled", effectiveDate: "2026-07-15" }),
      expect.objectContaining({ action: "reopened", reason: "Payment correction required" }),
    ]);
  });

  it("preserves correction, cancellation, settlement, and reopening state across App reloads", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const history = lendingHistory();
    await saveLendingHistory(repository, history);
    window.location.hash = `#/loans/${history.loan.id}`;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const first = render(<App dbName={dbName} />);

    await screen.findByRole("heading", { name: "Chi tiết khoản vay" });
    await user.click(screen.getByRole("button", { name: "Sửa giao dịch" }));
    await user.clear(screen.getByLabelText("Gốc đã thu (đ)"));
    await user.type(screen.getByLabelText("Gốc đã thu (đ)"), "120000");
    await user.type(screen.getByLabelText("Lý do điều chỉnh"), "Replacement was too high");
    await user.click(screen.getByRole("button", { name: "Lưu điều chỉnh" }));

    expect(await screen.findByText("Gốc còn phải thu: 880.000 đ")).toBeInTheDocument();
    expect(screen.getByText("Lãi còn phải thu: 18.000 đ")).toBeInTheDocument();
    const replacement = (await repository.listPayments(history.loan.id))[0];
    expect(replacement).toMatchObject({ principalAmount: 120_000, interestAmount: 2_000, status: "active" });

    await user.click(screen.getByRole("button", { name: "Hủy giao dịch" }));
    await user.type(screen.getByLabelText("Lý do điều chỉnh"), "Replacement rejected");
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy giao dịch" }));

    expect(await screen.findByText("Gốc còn phải thu: 1.000.000 đ")).toBeInTheDocument();
    expect(screen.getByText("Lãi còn phải thu: 20.000 đ")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Ghi nhận khoản thu" })[0]);
    await user.type(screen.getByLabelText("Ngày thu"), "2026-07-15");
    await user.type(screen.getByLabelText("Gốc đã thu (đ)"), "1000000");
    await user.type(screen.getByLabelText("Lãi đã thu (đ)"), "20000");
    await user.click(screen.getByRole("button", { name: "Lưu khoản thu" }));

    expect(await screen.findByText("Đủ điều kiện tất toán")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Ngày tất toán"));
    await user.type(screen.getByLabelText("Ngày tất toán"), "2026-07-15");
    await user.click(screen.getByRole("button", { name: "Xác nhận tất toán" }));
    await screen.findByText("Đã tất toán khoản vay");
    first.unmount();

    const settled = render(<App dbName={dbName} />);
    await screen.findByText("Ngày tất toán: 2026-07-15");
    for (const historyEntry of screen.getAllByText("Lịch sử điều chỉnh")) {
      await user.click(historyEntry);
    }
    expect(screen.getByText("Replacement was too high")).toBeInTheDocument();
    expect(screen.getByText("Replacement rejected")).toBeInTheDocument();
    expect(screen.getByText("Đã tất toán: 2026-07-15")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mở lại khoản vay" }));
    await user.type(screen.getByLabelText("Lý do mở lại khoản vay"), "Correction needs another review");
    await user.click(screen.getByRole("button", { name: "Xác nhận mở lại" }));
    await screen.findByText("Đã mở lại khoản vay");
    settled.unmount();

    render(<App dbName={dbName} />);
    expect(await screen.findByText("Đủ điều kiện tất toán")).toBeInTheDocument();
    await expect(repository.listLoans(history.borrower.id)).resolves.toEqual([
      expect.objectContaining({ id: history.loan.id, status: "active" }),
    ]);
    await expect(repository.listPaymentHistory(history.loan.id)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: history.payment.id, status: "adjusted" }),
      expect.objectContaining({ id: replacement.id, status: "voided" }),
    ]));
    await expect(repository.listLoanLifecycleEvents(history.loan.id)).resolves.toEqual([
      expect.objectContaining({ action: "settled", effectiveDate: "2026-07-15" }),
      expect.objectContaining({ action: "reopened", reason: "Correction needs another review" }),
    ]);
    expect(confirm).toHaveBeenCalledWith("Xác nhận hủy giao dịch");
    confirm.mockRestore();
  });

  it("filters borrower loans from current collection data without changing IndexedDB", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const history = lendingHistory();
    const entry = {
      ...history.entry,
      dueDate: "2020-01-05",
      expectedPrincipal: 1_000_000,
      expectedInterest: 20_000,
    };
    await repository.saveBorrower(history.borrower);
    await repository.saveLoanBundle({ loan: history.loan, version: history.version, entries: [entry] });
    await repository.savePayment({
      ...history.payment,
      scheduleEntryId: entry.id,
      principalAmount: entry.expectedPrincipal,
      interestAmount: entry.expectedInterest,
    });
    const recordsBeforeFiltering = await repository.listAllDomainRecords();
    window.location.hash = `#/borrowers/${history.borrower.id}`;

    render(<App dbName={dbName} />);

    expect(await screen.findByRole("heading", { name: history.borrower.displayName })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Trạng thái thu tiền"), "paid");
    expect(screen.getByRole("button", { name: /1\.000\.000/ })).toBeInTheDocument();
    expect(await repository.listAllDomainRecords()).toEqual(recordsBeforeFiltering);
  });
});

function lendingHistory(): {
  borrower: Borrower;
  loan: Loan;
  version: ScheduleVersion;
  entry: ScheduleEntry;
  payment: PaymentTransaction;
  promise: PromiseToPay;
  settings: ReminderSettings;
} {
  const createdAt = "2026-07-28T00:00:00.000Z";
  const updatedAt = "2026-07-28T01:00:00.000Z";
  const borrower: Borrower = { id: "backup-borrower", displayName: "Nguyen Van A", status: "active", createdAt, updatedAt };
  const loan: Loan = {
    id: "backup-loan", borrowerId: borrower.id, calculationModel: "equal-principal-flat-interest", originalPrincipal: 1_000_000,
    disbursementDate: "2026-07-01", monthlyDueDay: 5, maturityDate: "2999-12-05", rateValue: 0.02, rateUnit: "monthly",
    partialPeriodInterestMode: "full-period", defaultScheduleVersionId: "backup-version", status: "active", createdAt, updatedAt,
  };
  const version: ScheduleVersion = {
    id: loan.defaultScheduleVersionId, loanId: loan.id, versionNumber: 1, effectiveDate: loan.disbursementDate,
    calculationModel: loan.calculationModel, principalBase: loan.originalPrincipal, disbursementDate: loan.disbursementDate,
    monthlyDueDay: loan.monthlyDueDay, maturityDate: loan.maturityDate, rateValue: loan.rateValue, rateUnit: loan.rateUnit,
    partialPeriodInterestMode: loan.partialPeriodInterestMode, createdAt,
  };
  const entry: ScheduleEntry = {
    id: "backup-entry", scheduleVersionId: version.id, periodStart: "2026-07-01", dueDate: "2999-08-05",
    expectedPrincipal: 1_000_000, expectedInterest: 20_000, status: "upcoming", createdAt, updatedAt,
  };
  const payment: PaymentTransaction = {
    id: "backup-payment", loanId: loan.id, scheduleEntryId: entry.id, receivedAt: "2026-07-05", principalAmount: 100_000,
    interestAmount: 2_000, createdAt,
  };
  const promise: PromiseToPay = {
    id: "backup-promise", loanId: loan.id, scheduleEntryId: entry.id, promisedDate: "2999-08-10", note: "After payday",
    status: "open", createdAt, updatedAt,
  };
  return { borrower, loan, version, entry, payment, promise, settings: { enabled: true, offsetDays: 1, time: "08:00" } };
}

async function saveLendingHistory(repository: IndexedDbLendingRepository, history: ReturnType<typeof lendingHistory>): Promise<void> {
  await repository.saveBorrower(history.borrower);
  await repository.saveLoanBundle({ loan: history.loan, version: history.version, entries: [history.entry] });
  await repository.savePayment(history.payment);
  await repository.savePromise(history.promise);
  await repository.saveReminderSettings(history.settings);
}

async function saveAuditedLendingHistory(repository: IndexedDbLendingRepository) {
  const history = lendingHistory();
  const originalPayment: PaymentTransaction = {
    ...history.payment,
    status: "adjusted",
    updatedAt: "2026-07-15T08:00:00.000Z",
  };
  const replacementPayment: PaymentTransaction = {
    ...history.payment,
    id: "backup-replacement-payment",
    principalAmount: 120_000,
    status: "voided",
    createdAt: "2026-07-15T08:00:00.000Z",
    updatedAt: "2026-07-15T09:00:00.000Z",
  };
  const editAdjustment: PaymentAdjustment = {
    id: "backup-edit-adjustment",
    loanId: history.loan.id,
    paymentId: originalPayment.id,
    replacementPaymentId: replacementPayment.id,
    action: "edit",
    reason: "Replacement was too high",
    before: {
      scheduleEntryId: history.entry.id,
      receivedAt: history.payment.receivedAt,
      principalAmount: history.payment.principalAmount,
      interestAmount: history.payment.interestAmount,
    },
    after: {
      scheduleEntryId: history.entry.id,
      receivedAt: replacementPayment.receivedAt,
      principalAmount: replacementPayment.principalAmount,
      interestAmount: replacementPayment.interestAmount,
    },
    createdAt: "2026-07-15T08:00:00.000Z",
  };
  const voidAdjustment: PaymentAdjustment = {
    id: "backup-void-adjustment",
    loanId: history.loan.id,
    paymentId: replacementPayment.id,
    action: "void",
    reason: "Replacement rejected",
    before: {
      scheduleEntryId: history.entry.id,
      receivedAt: replacementPayment.receivedAt,
      principalAmount: replacementPayment.principalAmount,
      interestAmount: replacementPayment.interestAmount,
    },
    createdAt: "2026-07-15T09:00:00.000Z",
  };
  const finalPayment: PaymentTransaction = {
    ...history.payment,
    id: "backup-final-payment",
    receivedAt: "2026-07-15",
    principalAmount: history.entry.expectedPrincipal,
    interestAmount: history.entry.expectedInterest,
    status: "active",
    createdAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-07-15T10:00:00.000Z",
  };
  const settlementEvent: LoanLifecycleEvent = {
    id: "z-backup-settlement",
    loanId: history.loan.id,
    action: "settled",
    effectiveDate: "2026-07-15",
    createdAt: "2026-07-15T11:00:00.000Z",
  };
  const reopenEvent: LoanLifecycleEvent = {
    id: "a-backup-reopening",
    loanId: history.loan.id,
    action: "reopened",
    effectiveDate: "2026-07-16",
    reason: "Correction needs another review",
    createdAt: "2026-07-16T08:00:00.000Z",
  };
  const settledLoan: Loan = {
    ...history.loan,
    status: "settled",
    settledAt: settlementEvent.effectiveDate,
    updatedAt: settlementEvent.createdAt,
  };
  const loan: Loan = {
    ...history.loan,
    status: "active",
    updatedAt: reopenEvent.createdAt,
  };

  await repository.saveBorrower(history.borrower);
  await repository.saveLoanBundle({ loan: history.loan, version: history.version, entries: [history.entry] });
  await repository.savePaymentCorrection({
    original: originalPayment,
    replacement: { ...replacementPayment, status: "active", updatedAt: editAdjustment.createdAt },
    adjustment: editAdjustment,
  });
  await repository.savePaymentCancellation({ original: replacementPayment, adjustment: voidAdjustment });
  await repository.savePayment(finalPayment);
  await repository.saveLoanLifecycleMutation({ loan: settledLoan, event: settlementEvent });
  await repository.saveLoanLifecycleMutation({ loan, event: reopenEvent });
  await repository.savePromise(history.promise);
  await repository.saveReminderSettings(history.settings);

  return {
    borrower: history.borrower,
    loan,
    originalPayment,
    replacementPayment,
    finalPayment,
    editAdjustment,
    voidAdjustment,
    settlementEvent,
    reopenEvent,
  };
}

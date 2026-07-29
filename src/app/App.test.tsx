import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEncryptedBackup } from "../backup/backupService";
import type { Borrower, Loan, PaymentTransaction, PromiseToPay, ReminderSettings, ScheduleEntry, ScheduleVersion } from "../lending/domain/types";
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

    await user.type(screen.getByLabelText("Backup passphrase"), "safe passphrase");
    await user.click(screen.getByRole("button", { name: "Backup" }));

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

    await user.type(screen.getByLabelText("Restore passphrase"), "safe passphrase");
    await user.upload(screen.getByLabelText("Backup file"), file);

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("Replace local records with this backup?"));
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
    await user.click(screen.getByRole("button", { name: "Reset lending data" }));

    expect(confirm).toHaveBeenCalledWith("Clear all local lending data?");
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
    expect(screen.getByLabelText("Enable global reminders")).toBeChecked();
    expect(screen.getByLabelText("Reminder offset (days)")).toHaveValue("1");
    expect(screen.getByLabelText("Reminder time")).toHaveValue("08:00");
    await user.clear(screen.getByLabelText("Reminder offset (days)"));
    await user.type(screen.getByLabelText("Reminder offset (days)"), "2");
    await user.clear(screen.getByLabelText("Reminder time"));
    await user.type(screen.getByLabelText("Reminder time"), "09:30");
    await user.click(screen.getByRole("button", { name: "Save reminder settings" }));
    first.unmount();

    render(<App dbName={dbName} />);
    await user.click(screen.getByRole("link", { name: "Cài đặt" }));
    await waitFor(() => expect(screen.getByLabelText("Reminder offset (days)")).toHaveValue("2"));
    expect(screen.getByLabelText("Reminder time")).toHaveValue("09:30");
  });

  it("downloads prepared calendar content as a deterministic ICS file without paid or closed events", async () => {
    const user = userEvent.setup();
    const dbName = nextDbName();
    const repository = new IndexedDbLendingRepository(new IndexedDbRecordStore(dbName));
    const { borrower, loan, version, entry } = lendingHistory();
    await repository.saveBorrower(borrower);
    await repository.saveLoanBundle({ loan: { ...loan, status: "settled" }, version, entries: [entry] });
    window.location.hash = `#/loans/${loan.id}`;
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;
    let createdBlob: Blob | undefined;
    const createElement = vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === "a") {
        createdAnchor = element as HTMLAnchorElement;
        vi.spyOn(createdAnchor, "click").mockImplementation(() => undefined);
      }
      return element;
    }) as typeof document.createElement);
    const createObjectURL = vi.fn((blob: Blob) => {
      createdBlob = blob;
      return "blob:calendar";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    render(<App dbName={dbName} />);
    await screen.findByRole("heading", { name: "Loan details" });
    await user.click(screen.getByRole("button", { name: "Export Calendar" }));

    await waitFor(() => expect(createdAnchor?.click).toHaveBeenCalledTimes(1));
    expect(createdAnchor?.download).toMatch(/^interest-manager-calendar-\d{4}-\d{2}-\d{2}\.ics$/);
    expect(createdBlob?.type).toBe("text/calendar;charset=utf-8");
    expect(await createdBlob?.text()).not.toContain("BEGIN:VEVENT");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:calendar");
    createElement.mockRestore();
    vi.unstubAllGlobals();
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
    await user.type(screen.getByLabelText("Backup passphrase"), "safe passphrase");
    await user.click(screen.getByRole("button", { name: "Backup" }));
    await waitFor(() => expect(backupBlob).toBeDefined());
    const backupFile = new File([await backupBlob!.text()], "backup.json", { type: "application/json" });
    await repository.replaceAllDomainRecords([]);
    await store.upsertRecord({ ...sharedRecord, updatedAt: "2026-07-29T00:00:00.000Z", data: { origin: "after-export" } });

    await user.type(screen.getByLabelText("Restore passphrase"), "safe passphrase");
    await user.upload(screen.getByLabelText("Backup file"), backupFile);

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("Replace local records with this backup?"));
    await expect(repository.listAllDomainRecords()).resolves.toEqual(expectedDomainRecords);
    await expect(store.listRecordsByType("system.smoke")).resolves.toEqual([expect.objectContaining({ data: { origin: "after-export" } })]);
    createElement.mockRestore();
    vi.unstubAllGlobals();
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
    await user.type(screen.getByLabelText("Principal (VND)"), "10000000");
    await user.type(screen.getByLabelText("Disbursement date"), "2026-06-20");
    await user.selectOptions(screen.getByLabelText("Calculation model"), "equal-principal-flat-interest");
    await user.clear(screen.getByLabelText("Monthly due day"));
    await user.type(screen.getByLabelText("Monthly due day"), "5");
    await user.type(screen.getByLabelText("Maturity date"), "2026-12-15");
    await user.type(screen.getByLabelText("Rate (%)"), "2");
    await user.click(screen.getByRole("button", { name: "Preview schedule" }));
    await user.click(await screen.findByRole("button", { name: "Confirm and save loan" }));

    expect(await screen.findByRole("heading", { name: "Loan details" })).toBeInTheDocument();
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

    await screen.findByRole("heading", { name: "Loan details" });
    await user.click(screen.getByRole("button", { name: "Export Calendar" }));
    await screen.findByText("Đã cập nhật trạng thái lịch Calendar");
    expect(onCalendarExport).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("BEGIN:VCALENDAR"),
      loanId: loan.id,
      scheduleVersionId: version.id,
    }));
    expect(await repository.listLoans(borrower.id)).toEqual([expect.objectContaining({ calendarExportVersionId: version.id })]);
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    await user.type(screen.getByLabelText("Received date"), "2026-07-29");
    await user.type(screen.getByLabelText("Principal received (VND)"), "1000000");
    await user.type(screen.getByLabelText("Interest received (VND)"), "20000");
    await user.click(screen.getByRole("button", { name: "Save payment" }));
    await screen.findByText("Đã ghi nhận khoản thu");
    expect(await repository.listPayments(loan.id)).toEqual([expect.objectContaining({ principalAmount: 1_000_000, interestAmount: 20_000 })]);
    await user.click(screen.getByRole("button", { name: "Export Calendar" }));
    await waitFor(() => expect(onCalendarExport).toHaveBeenCalledTimes(2));
    expect(onCalendarExport.mock.calls[1][0].content).not.toContain("BEGIN:VEVENT");

    const saveLoanBundle = vi.spyOn(IndexedDbLendingRepository.prototype, "saveLoanBundle");
    const saveLoan = vi.spyOn(IndexedDbLendingRepository.prototype, "saveLoan");
    const saveScheduleVersion = vi.spyOn(IndexedDbLendingRepository.prototype, "saveScheduleVersion");
    const saveScheduleEntries = vi.spyOn(IndexedDbLendingRepository.prototype, "saveScheduleEntries");
    await user.click(screen.getByRole("button", { name: "Revise schedule" }));
    await user.clear(screen.getByLabelText("Effective date"));
    await user.type(screen.getByLabelText("Effective date"), "2026-08-01");
    await user.clear(screen.getByLabelText("Maturity date"));
    await user.type(screen.getByLabelText("Maturity date"), "2027-01-15");
    await user.click(screen.getByRole("button", { name: "Save revision" }));
    await screen.findByText("Đã điều chỉnh lịch thu; lịch Calendar cần xuất lại");
    await waitFor(async () => expect(await repository.listScheduleVersions(loan.id)).toHaveLength(2));
    const [updatedLoan] = await repository.listLoans(borrower.id);
    expect(updatedLoan.defaultScheduleVersionId).not.toBe(version.id);
    expect(updatedLoan.calendarExportVersionId).toBe(version.id);
    expect(await repository.listScheduleEntries(version.id)).toEqual([entry]);
    expect(screen.getByText("Outstanding principal: 1.000.000 đ")).toBeInTheDocument();
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
    await screen.findByRole("heading", { name: "Loan details" });
    await user.click(screen.getByRole("button", { name: "Export Calendar" }));
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
    await screen.findByRole("heading", { name: "Loan details" });
    await user.click(screen.getByRole("button", { name: "Export Calendar" }));
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

    await screen.findByRole("heading", { name: "Global reminders" });
    await user.clear(screen.getByLabelText("Reminder offset (days)"));
    await user.type(screen.getByLabelText("Reminder offset (days)"), "2");
    await user.click(screen.getByRole("button", { name: "Save reminder settings" }));

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

    await screen.findByRole("heading", { name: "Loan details" });
    await user.click(screen.getByLabelText("Use loan reminder override"));
    await user.clear(screen.getByLabelText("Loan reminder offset (days)"));
    await user.type(screen.getByLabelText("Loan reminder offset (days)"), "4");
    await user.clear(screen.getByLabelText("Loan reminder time"));
    await user.type(screen.getByLabelText("Loan reminder time"), "10:15");
    await user.click(screen.getByRole("button", { name: "Save loan reminders" }));

    await waitFor(async () => expect(await repository.listLoans()).toEqual([
      expect.objectContaining({
        reminderOverride: { enabled: true, offsetDays: 4, time: "10:15" },
      }),
    ]));
    expect((await repository.listLoans())[0]).not.toHaveProperty("calendarExportVersionId");

    await user.click(screen.getByRole("button", { name: "Clear loan override" }));
    await waitFor(async () => expect((await repository.listLoans())[0]).not.toHaveProperty("reminderOverride"));
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

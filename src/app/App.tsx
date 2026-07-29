import { Archive, FileUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEncryptedBackup, restoreEncryptedBackup } from "../backup/backupService";
import {
  calculateEntryStatus,
  calculateLoanSummary,
  selectCurrentLoanEntries,
} from "../lending/domain/ledger";
import { createScheduleRevision, type RevisionInput } from "../lending/domain/revisions";
import { generateSchedule } from "../lending/domain/scheduleGenerator";
import type { Borrower, Loan, PaymentTransaction, PromiseToPay, ReminderOverride, ScheduleEntry, ScheduleVersion } from "../lending/domain/types";
import { buildIcsCalendar, buildScheduleCalendarEvents } from "../lending/reminders/ical";
import { DEFAULT_REMINDER_SETTINGS, resolveReminderSettings } from "../lending/reminders/reminderSettings";
import { IndexedDbLendingRepository } from "../lending/storage/lendingRepository";
import { BorrowerDetail } from "../lending/ui/BorrowerDetail";
import { BorrowerForm } from "../lending/ui/BorrowerForm";
import { BorrowerList } from "../lending/ui/BorrowerList";
import { Dashboard } from "../lending/ui/Dashboard";
import { LoanForm, type LoanDraft } from "../lending/ui/LoanForm";
import { LoanDetail } from "../lending/ui/LoanDetail";
import { ReminderSettings } from "../lending/ui/ReminderSettings";
import { AppError } from "../shared/errors";
import { IndexedDbRecordStore } from "../storage/indexedDbRecordStore";
import type { StorageHealth } from "../storage/types";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { StatusBadge } from "../ui/StatusBadge";
import { vi } from "../i18n/vi";
import { parseHashRoute, serializeHashRoute, type Route } from "./routes";

type AppProps = {
  dbName?: string;
  onCalendarExport?(value: PreparedCalendarExport): Promise<void> | void;
};

export interface PreparedCalendarExport {
  content: string;
  loanId: string;
  scheduleVersionId: string;
}

const initialHealth: StorageHealth = {
  available: false,
  recordCount: 0,
  message: "Checking storage",
};

function recordLabel(count: number): string {
  return vi.shellStatus.recordCount(count);
}

function storageStatusLabel(message: string): string {
  return vi.shellStatus.storage[message as keyof typeof vi.shellStatus.storage] ?? vi.shellStatus.storage["Storage unavailable"];
}

function shellMessageLabel(message: string): string {
  return vi.shellStatus.messages[message as keyof typeof vi.shellStatus.messages] ?? vi.shellStatus.messages.unknown;
}

function todayFileName(): string {
  return `interest-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

function calendarFileName(today: string): string {
  return `interest-manager-calendar-${today}.ics`;
}

function downloadJson(fileName: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function messageFromRestoreError(error: unknown): string {
  if (error instanceof AppError) {
    if (error.code === "invalid-backup") {
      return "Invalid backup file";
    }
    if (error.code === "unsupported-backup-version") {
      return "Unsupported backup version";
    }
    if (error.code === "decrypt-failed") {
      return "Wrong backup passphrase";
    }
  }

  return "Restore failed";
}

function downloadCalendar(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function todayInVietnam(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
}

export function App({ dbName, onCalendarExport }: AppProps) {
  const store = useMemo(() => new IndexedDbRecordStore(dbName), [dbName]);
  const repository = useMemo(() => new IndexedDbLendingRepository(store), [store]);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [health, setHealth] = useState<StorageHealth>(initialHealth);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [route, setRoute] = useState<Route>(() => parseHashRoute(window.location.hash));
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [scheduleVersions, setScheduleVersions] = useState<ScheduleVersion[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [promises, setPromises] = useState<PromiseToPay[]>([]);
  const [reminderSettings, setReminderSettings] = useState(DEFAULT_REMINDER_SETTINGS);
  const [mode, setMode] = useState<"none" | "create-borrower" | "edit-borrower" | "create-loan">("none");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [message, setMessage] = useState("Ready");

  const refreshHealth = useCallback(async () => {
    setHealth(await store.getHealth());
  }, [store]);

  const refreshLendingData = useCallback(async () => {
    const [nextBorrowers, nextLoans, nextVersions, nextEntries, nextPayments, nextPromises, nextReminderSettings] = await Promise.all([
      repository.listBorrowers(),
      repository.listLoans(),
      repository.listScheduleVersions(),
      repository.listScheduleEntries(),
      repository.listPayments(),
      repository.listPromises(),
      repository.getReminderSettings(),
    ]);
    setBorrowers(nextBorrowers);
    setLoans(nextLoans);
    setScheduleVersions(nextVersions);
    setScheduleEntries(nextEntries);
    setPayments(nextPayments);
    setPromises(nextPromises);
    setReminderSettings(nextReminderSettings ?? DEFAULT_REMINDER_SETTINGS);
  }, [repository]);

  useEffect(() => {
    void refreshHealth();
    void refreshLendingData();
  }, [refreshHealth, refreshLendingData]);

  useEffect(() => {
    const handleHashChange = () => setRoute(parseHashRoute(window.location.hash));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    setMode("none");
  }, [route]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const handlePwaError = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      setMessage(customEvent.detail.message ?? "Offline cache unavailable");
    };

    window.addEventListener("interest-manager:pwa-error", handlePwaError);
    return () => window.removeEventListener("interest-manager:pwa-error", handlePwaError);
  }, []);

  const navigate = useCallback((nextRoute: Route) => {
    const hash = serializeHashRoute(nextRoute);
    setRoute(nextRoute);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  }, []);

  const saveBorrower = async (value: Borrower) => {
    await repository.saveBorrower(value);
    await Promise.all([refreshHealth(), refreshLendingData()]);
    setMessage(value.status === "archived" ? "Borrower archived" : "Borrower saved");
    navigate({ name: "borrower", borrowerId: value.id });
  };

  const saveLoan = async (input: LoanDraft) => {
    const now = new Date().toISOString();
    const loanId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const loan: Loan = {
      id: loanId,
      borrowerId: input.borrowerId,
      calculationModel: input.calculationModel,
      originalPrincipal: input.originalPrincipal,
      disbursementDate: input.disbursementDate,
      monthlyDueDay: input.monthlyDueDay,
      maturityDate: input.maturityDate,
      rateValue: input.rateValue,
      rateUnit: input.rateUnit,
      partialPeriodInterestMode: input.partialPeriodInterestMode,
      defaultScheduleVersionId: versionId,
      reminderOverride: input.reminderOverride,
      status: "active",
      note: input.note,
      createdAt: now,
      updatedAt: now,
    };
    const version: ScheduleVersion = {
      id: versionId,
      loanId,
      versionNumber: 1,
      effectiveDate: input.disbursementDate,
      calculationModel: input.calculationModel,
      principalBase: input.originalPrincipal,
      disbursementDate: input.disbursementDate,
      monthlyDueDay: input.monthlyDueDay,
      maturityDate: input.maturityDate,
      rateValue: input.rateValue,
      rateUnit: input.rateUnit,
      partialPeriodInterestMode: input.partialPeriodInterestMode,
      createdAt: now,
    };

    await repository.saveLoanBundle({ loan, version, entries: generateSchedule(version) });
    await Promise.all([refreshHealth(), refreshLendingData()]);
    setMessage("Loan saved");
    navigate({ name: "loan", loanId });
  };

  const savePayment = async (value: PaymentTransaction) => {
    await repository.savePayment(value);
    await Promise.all([refreshHealth(), refreshLendingData()]);
    setMessage("Payment recorded");
  };

  const savePromise = async (value: PromiseToPay) => {
    await repository.savePromise(value);
    await Promise.all([refreshHealth(), refreshLendingData()]);
    setMessage("Promise recorded");
  };

  const updatePromise = async (value: PromiseToPay) => {
    await repository.savePromise(value);
    await Promise.all([refreshHealth(), refreshLendingData()]);
    setMessage(value.status === "fulfilled" ? "Promise fulfilled" : "Promise cancelled");
  };

  const saveReminderSettings = async (value: typeof reminderSettings) => {
    await repository.saveReminderSettings(value);
    setReminderSettings(value);
    await refreshHealth();
    setMessage("Reminder settings saved");
  };

  const saveLoanReminderOverride = async (loanToUpdate: Loan, value?: ReminderOverride) => {
    const {
      calendarExportVersionId: _calendarExportVersionId,
      reminderOverride: _reminderOverride,
      ...current
    } = loanToUpdate;
    await repository.saveLoan({
      ...current,
      ...(value ? { reminderOverride: value } : {}),
      updatedAt: new Date().toISOString(),
    });
    await Promise.all([refreshHealth(), refreshLendingData()]);
    setMessage(value ? "Loan reminder override saved" : "Loan reminder override cleared");
  };

  const saveRevision = async (loanToRevise: Loan, input: RevisionInput) => {
    const revision = createScheduleRevision(input);
    await repository.saveLoanBundle({
      version: revision.version,
      entries: revision.entries,
      loan: {
        ...loanToRevise,
        defaultScheduleVersionId: revision.activeScheduleVersionId,
        updatedAt: input.createdAt,
      },
    });
    await Promise.all([refreshHealth(), refreshLendingData()]);
    setMessage("Schedule revised; Calendar export is stale");
  };

  const markCalendarExportCurrent = async (loanToUpdate: Loan, versionId: string) => {
    await repository.saveLoan({
      ...loanToUpdate,
      calendarExportVersionId: versionId,
      updatedAt: new Date().toISOString(),
    });
    await Promise.all([refreshHealth(), refreshLendingData()]);
    setMessage("Calendar export marked current");
  };

  const prepareCalendarExport = async (input: {
    loan: Loan;
    borrowerName: string;
    entries: ScheduleEntry[];
    versions: ScheduleVersion[];
    payments: PaymentTransaction[];
    promises: PromiseToPay[];
  }) => {
    try {
      const today = todayInVietnam();
      const entries = selectCurrentLoanEntries({
        entries: input.entries,
        versions: input.versions,
        activeScheduleVersionId: input.loan.defaultScheduleVersionId,
      })
        .map((entry) => ({
          ...entry,
          status: calculateEntryStatus({ entry, payments: input.payments, promises: input.promises, today }),
        }));
      const content = buildIcsCalendar(input.loan.status === "active" ? buildScheduleCalendarEvents({
        entries,
        promises: input.promises,
        borrowerName: input.borrowerName,
        loanLabel: `Loan ${input.loan.id}`,
        settings: resolveReminderSettings(reminderSettings, input.loan.reminderOverride),
        today,
      }) : []);
      const preparedExport = {
        content,
        loanId: input.loan.id,
        scheduleVersionId: input.loan.defaultScheduleVersionId,
      };
      if (onCalendarExport) {
        await onCalendarExport(preparedExport);
      } else {
        downloadCalendar(calendarFileName(today), content);
      }
      await markCalendarExportCurrent(input.loan, input.loan.defaultScheduleVersionId);
    } catch {
      setMessage("Calendar export could not be prepared");
    }
  };

  const exportBackup = async () => {
    if (!backupPassphrase.trim()) {
      setMessage("Backup passphrase required");
      return;
    }

    const records = await repository.listAllDomainRecords();
    const backup = await createEncryptedBackup(records, backupPassphrase);
    downloadJson(todayFileName(), backup);
    setMessage("Backup exported");
  };

  const resetLendingData = async () => {
    if (!window.confirm("Clear all local lending data?")) {
      setMessage("Reset cancelled");
      return;
    }

    await repository.replaceAllDomainRecords([]);
    setMessage("Local lending data reset");
    await Promise.all([refreshHealth(), refreshLendingData()]);
  };

  const restoreBackupFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!restorePassphrase.trim()) {
      setMessage("Restore passphrase required");
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const restored = await restoreEncryptedBackup(parsed, restorePassphrase);
      if (!window.confirm("Replace local records with this backup?")) {
        setMessage("Restore cancelled");
        return;
      }
      await repository.replaceAllDomainRecords(restored.records);
      setMessage("Backup restored");
      await Promise.all([refreshHealth(), refreshLendingData()]);
    } catch (error) {
      setMessage(messageFromRestoreError(error));
    } finally {
      if (restoreInputRef.current) {
        restoreInputRef.current.value = "";
      }
    }
  };

  const borrower = route.name === "borrower" ? borrowers.find((candidate) => candidate.id === route.borrowerId) : undefined;
  const loan = route.name === "loan" ? loans.find((candidate) => candidate.id === route.loanId) : undefined;
  const dashboardSummaries = loans
    .filter((candidate) => candidate.status === "active")
    .map((candidate) => calculateLoanSummary({
      loanId: candidate.id,
      entries: selectCurrentLoanEntries({
        entries: scheduleEntries,
        versions: scheduleVersions,
        activeScheduleVersionId: candidate.defaultScheduleVersionId,
      }),
      payments: payments.filter((payment) => payment.loanId === candidate.id),
      promises: promises.filter((promise) => promise.loanId === candidate.id),
      today: todayInVietnam(),
    }));

  const routeContent = (() => {
    if (route.name === "settings") {
      return (
        <section className="operations-grid" aria-label="Backup and restore">
          <ReminderSettings value={reminderSettings} onSave={saveReminderSettings} />
          <div className="operation-panel">
            <h2>Backup</h2>
            <Field label="Backup passphrase" type="password" value={backupPassphrase} onChange={(event) => setBackupPassphrase(event.target.value)} />
            <Button icon={<Archive aria-hidden="true" size={18} />} variant="primary" onClick={exportBackup}>Backup</Button>
          </div>
          <div className="operation-panel">
            <h2>Restore</h2>
            <Field label="Restore passphrase" type="password" value={restorePassphrase} onChange={(event) => setRestorePassphrase(event.target.value)} />
            <input ref={restoreInputRef} aria-label="Backup file" className="file-input" type="file" accept="application/json,.json" onChange={(event) => void restoreBackupFile(event.target.files?.[0])} />
            <Button icon={<FileUp aria-hidden="true" size={18} />} onClick={() => restoreInputRef.current?.click()}>Restore</Button>
          </div>
          <div className="operation-panel">
            <h2>Reset</h2>
            <Button icon={<Trash2 aria-hidden="true" size={18} />} variant="danger" onClick={resetLendingData}>Reset lending data</Button>
          </div>
        </section>
      );
    }
    if (route.name === "borrower") {
      if (!borrower) {
        return <section className="route-panel"><h2>{vi.borrower.notFound}</h2><Button onClick={() => navigate({ name: "dashboard" })}>{vi.borrower.title}</Button></section>;
      }
      if (mode === "edit-borrower") {
        return <section className="route-panel"><h2>{vi.borrower.edit}</h2><BorrowerForm value={borrower} onSave={saveBorrower} onCancel={() => setMode("none")} /></section>;
      }
      if (mode === "create-loan") {
        return <LoanForm borrowerId={borrower.id} onSave={saveLoan} onCancel={() => setMode("none")} />;
      }
      return <BorrowerDetail borrower={borrower} loans={loans.filter((candidate) => candidate.borrowerId === borrower.id)} onBack={() => navigate({ name: "dashboard" })} onEdit={() => setMode("edit-borrower")} onCreateLoan={() => setMode("create-loan")} onSelectLoan={(loanId) => navigate({ name: "loan", loanId })} />;
    }
    if (route.name === "loan") {
      if (!loan) {
        return <section className="route-panel"><h2>{vi.loan.notFound}</h2><Button onClick={() => navigate({ name: "dashboard" })}>{vi.borrower.title}</Button></section>;
      }
      const loanBorrower = borrowers.find((candidate) => candidate.id === loan.borrowerId);
      const loanVersions = scheduleVersions.filter((version) => version.loanId === loan.id);
      const loanVersionIds = new Set(loanVersions.map((version) => version.id));
      return <LoanDetail
        loan={loan}
        borrowerName={loanBorrower?.displayName ?? "Unknown borrower"}
        versions={loanVersions}
        entries={scheduleEntries.filter((entry) => loanVersionIds.has(entry.scheduleVersionId))}
        payments={payments.filter((payment) => payment.loanId === loan.id)}
        promises={promises.filter((promise) => promise.loanId === loan.id)}
        today={todayInVietnam()}
        calendarExportVersionId={loan.calendarExportVersionId}
        onBack={() => navigate({ name: "borrower", borrowerId: loan.borrowerId })}
        onSavePayment={savePayment}
        onSavePromise={savePromise}
        onUpdatePromise={updatePromise}
        onSaveRevision={(input) => saveRevision(loan, input)}
        onSaveReminderOverride={(value) => saveLoanReminderOverride(loan, value)}
        onExportCalendar={() => void prepareCalendarExport({
          loan,
          borrowerName: loanBorrower?.displayName ?? "Unknown borrower",
          entries: scheduleEntries.filter((entry) => loanVersionIds.has(entry.scheduleVersionId)),
          versions: loanVersions,
          payments: payments.filter((payment) => payment.loanId === loan.id),
          promises: promises.filter((promise) => promise.loanId === loan.id),
        })}
      />;
    }
    if (mode === "create-borrower") {
      return <section className="route-panel"><h2>{vi.borrower.new}</h2><BorrowerForm onSave={saveBorrower} onCancel={() => setMode("none")} /></section>;
    }
    return <>
      <Dashboard summaries={dashboardSummaries} onOpenLoan={(loanId) => navigate({ name: "loan", loanId })} />
      <section className="route-panel" aria-labelledby="borrowers-heading"><div className="route-heading"><h2 id="borrowers-heading">{vi.borrower.title}</h2><Button icon={<Plus aria-hidden="true" size={18} />} variant="primary" onClick={() => setMode("create-borrower")}>{vi.borrower.new}</Button></div><BorrowerList borrowers={borrowers} onSelect={(borrowerId) => navigate({ name: "borrower", borrowerId })} /></section>
    </>;
  })();

  return (
    <main className="app-shell">
      <section className="hero-band">
        <h1>{vi.appName}</h1>
        <nav className="app-nav" aria-label="Primary navigation">
          <a href={serializeHashRoute({ name: "dashboard" })}>{vi.navigation.home}</a>
          <a href={serializeHashRoute({ name: "settings" })}>{vi.navigation.settings}</a>
        </nav>
      </section>

      <section className="status-strip" aria-label="System status">
        <StatusBadge tone={isOnline ? "ok" : "warn"}>{isOnline ? vi.shellStatus.online : vi.shellStatus.offline}</StatusBadge>
        <StatusBadge tone={health.available ? "ok" : "error"}>{storageStatusLabel(health.message)}</StatusBadge>
        <span className="record-count">{recordLabel(health.recordCount)}</span>
        <span className="status-message">{shellMessageLabel(message)}</span>
      </section>

      {routeContent}
    </main>
  );
}

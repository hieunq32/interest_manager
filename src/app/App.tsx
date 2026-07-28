import { Archive, FileUp, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEncryptedBackup, restoreEncryptedBackup } from "../backup/backupService";
import { createScheduleRevision, type RevisionInput } from "../lending/domain/revisions";
import { generateSchedule } from "../lending/domain/scheduleGenerator";
import type { Borrower, Loan, PaymentTransaction, PromiseToPay, ScheduleEntry, ScheduleVersion } from "../lending/domain/types";
import { IndexedDbLendingRepository } from "../lending/storage/lendingRepository";
import { BorrowerDetail } from "../lending/ui/BorrowerDetail";
import { BorrowerForm } from "../lending/ui/BorrowerForm";
import { BorrowerList } from "../lending/ui/BorrowerList";
import { formatMoneyVnd } from "../lending/ui/lendingLabels";
import { LoanForm, type LoanDraft } from "../lending/ui/LoanForm";
import { LoanDetail } from "../lending/ui/LoanDetail";
import { AppError } from "../shared/errors";
import { IndexedDbRecordStore } from "../storage/indexedDbRecordStore";
import type { StorageHealth } from "../storage/types";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { StatusBadge } from "../ui/StatusBadge";
import { parseHashRoute, serializeHashRoute, type Route } from "./routes";

type AppProps = {
  dbName?: string;
};

const initialHealth: StorageHealth = {
  available: false,
  recordCount: 0,
  message: "Checking storage",
};

function recordLabel(count: number): string {
  return count === 1 ? "1 record" : `${count} records`;
}

function todayFileName(): string {
  return `interest-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
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

export function App({ dbName }: AppProps) {
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
  const [mode, setMode] = useState<"none" | "create-borrower" | "edit-borrower" | "create-loan">("none");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [message, setMessage] = useState("Ready");

  const refreshHealth = useCallback(async () => {
    setHealth(await store.getHealth());
  }, [store]);

  const refreshLendingData = useCallback(async () => {
    const [nextBorrowers, nextLoans, nextVersions, nextEntries, nextPayments, nextPromises] = await Promise.all([
      repository.listBorrowers(),
      repository.listLoans(),
      repository.listScheduleVersions(),
      repository.listScheduleEntries(),
      repository.listPayments(),
      repository.listPromises(),
    ]);
    setBorrowers(nextBorrowers);
    setLoans(nextLoans);
    setScheduleVersions(nextVersions);
    setScheduleEntries(nextEntries);
    setPayments(nextPayments);
    setPromises(nextPromises);
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

  const saveRevision = async (loanToRevise: Loan, input: RevisionInput) => {
    const revision = createScheduleRevision(input);
    await repository.saveScheduleVersion(revision.version);
    await repository.saveScheduleEntries(revision.entries);
    await repository.saveLoan({
      ...loanToRevise,
      defaultScheduleVersionId: revision.activeScheduleVersionId,
      updatedAt: input.createdAt,
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

  const exportBackup = async () => {
    if (!backupPassphrase.trim()) {
      setMessage("Backup passphrase required");
      return;
    }

    const records = await store.listRecords();
    const backup = await createEncryptedBackup(records, backupPassphrase);
    downloadJson(todayFileName(), backup);
    setMessage("Backup exported");
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
      await store.replaceRecords(restored.records);
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

  const routeContent = (() => {
    if (route.name === "settings") {
      return (
        <section className="operations-grid" aria-label="Backup and restore">
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
        </section>
      );
    }
    if (route.name === "borrower") {
      if (!borrower) {
        return <section className="route-panel"><h2>Borrower not found</h2><Button onClick={() => navigate({ name: "dashboard" })}>Borrowers</Button></section>;
      }
      if (mode === "edit-borrower") {
        return <section className="route-panel"><h2>Edit borrower</h2><BorrowerForm value={borrower} onSave={saveBorrower} onCancel={() => setMode("none")} /></section>;
      }
      if (mode === "create-loan") {
        return <LoanForm borrowerId={borrower.id} onSave={saveLoan} onCancel={() => setMode("none")} />;
      }
      return <BorrowerDetail borrower={borrower} loans={loans.filter((candidate) => candidate.borrowerId === borrower.id)} onBack={() => navigate({ name: "dashboard" })} onEdit={() => setMode("edit-borrower")} onCreateLoan={() => setMode("create-loan")} onSelectLoan={(loanId) => navigate({ name: "loan", loanId })} />;
    }
    if (route.name === "loan") {
      if (!loan) {
        return <section className="route-panel"><h2>Loan not found</h2><Button onClick={() => navigate({ name: "dashboard" })}>Borrowers</Button></section>;
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
        onExportCalendar={(versionId) => void markCalendarExportCurrent(loan, versionId)}
      />;
    }
    if (mode === "create-borrower") {
      return <section className="route-panel"><h2>New borrower</h2><BorrowerForm onSave={saveBorrower} onCancel={() => setMode("none")} /></section>;
    }
    return <section className="route-panel" aria-labelledby="borrowers-heading"><div className="route-heading"><h2 id="borrowers-heading">Borrowers</h2><Button icon={<Plus aria-hidden="true" size={18} />} variant="primary" onClick={() => setMode("create-borrower")}>New borrower</Button></div><BorrowerList borrowers={borrowers} onSelect={(borrowerId) => navigate({ name: "borrower", borrowerId })} /></section>;
  })();

  return (
    <main className="app-shell">
      <section className="hero-band">
        <h1>Interest Manager</h1>
        <nav className="app-nav" aria-label="Primary navigation">
          <a href={serializeHashRoute({ name: "dashboard" })}>Home</a>
          <a href={serializeHashRoute({ name: "settings" })}>Settings</a>
        </nav>
      </section>

      <section className="status-strip" aria-label="System status">
        <StatusBadge tone={isOnline ? "ok" : "warn"}>{isOnline ? "Online" : "Offline"}</StatusBadge>
        <StatusBadge tone={health.available ? "ok" : "error"}>{health.message}</StatusBadge>
        <span className="record-count">{recordLabel(health.recordCount)}</span>
        <span className="status-message">{message}</span>
      </section>

      {routeContent}
    </main>
  );
}

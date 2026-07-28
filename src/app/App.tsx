import { Archive, FileUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEncryptedBackup, restoreEncryptedBackup } from "../backup/backupService";
import type { GenericRecord } from "../backup/types";
import { AppError } from "../shared/errors";
import { IndexedDbRecordStore } from "../storage/indexedDbRecordStore";
import type { StorageHealth } from "../storage/types";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { StatusBadge } from "../ui/StatusBadge";

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

export function App({ dbName }: AppProps) {
  const store = useMemo(() => new IndexedDbRecordStore(dbName), [dbName]);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [health, setHealth] = useState<StorageHealth>(initialHealth);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [message, setMessage] = useState("Ready");

  const refreshHealth = useCallback(async () => {
    setHealth(await store.getHealth());
  }, [store]);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

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

  const addSmokeRecord = async () => {
    const now = new Date().toISOString();
    const record: GenericRecord = {
      id: `system-smoke-${Date.now()}`,
      type: "system.smoke",
      createdAt: now,
      updatedAt: now,
      data: { note: "Storage smoke record" },
    };
    await store.upsertRecord(record);
    setMessage("Smoke record saved");
    await refreshHealth();
  };

  const clearRecords = async () => {
    await store.clearRecords();
    setMessage("Local records cleared");
    await refreshHealth();
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
      await refreshHealth();
    } catch (error) {
      setMessage(messageFromRestoreError(error));
    } finally {
      if (restoreInputRef.current) {
        restoreInputRef.current.value = "";
      }
    }
  };

  return (
    <main className="app-shell">
      <section className="hero-band">
        <h1>Interest Manager</h1>
      </section>

      <section className="status-strip" aria-label="System status">
        <StatusBadge tone={isOnline ? "ok" : "warn"}>{isOnline ? "Online" : "Offline"}</StatusBadge>
        <StatusBadge tone={health.available ? "ok" : "error"}>{health.message}</StatusBadge>
        <span className="record-count">{recordLabel(health.recordCount)}</span>
        <span className="status-message">{message}</span>
      </section>

      <section className="operations-grid" aria-label="Base operations">
        <div className="operation-panel">
          <h2>Storage</h2>
          <div className="button-row">
            <Button icon={<Plus aria-hidden="true" size={18} />} onClick={addSmokeRecord}>
              Add smoke record
            </Button>
            <Button icon={<Trash2 aria-hidden="true" size={18} />} variant="danger" onClick={clearRecords}>
              Clear
            </Button>
          </div>
        </div>

        <div className="operation-panel">
          <h2>Backup</h2>
          <Field
            label="Backup passphrase"
            type="password"
            value={backupPassphrase}
            onChange={(event) => setBackupPassphrase(event.target.value)}
          />
          <Button icon={<Archive aria-hidden="true" size={18} />} variant="primary" onClick={exportBackup}>
            Backup
          </Button>
        </div>

        <div className="operation-panel">
          <h2>Restore</h2>
          <Field
            label="Restore passphrase"
            type="password"
            value={restorePassphrase}
            onChange={(event) => setRestorePassphrase(event.target.value)}
          />
          <input
            ref={restoreInputRef}
            aria-label="Backup file"
            className="file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void restoreBackupFile(event.target.files?.[0])}
          />
          <Button icon={<FileUp aria-hidden="true" size={18} />} onClick={() => restoreInputRef.current?.click()}>
            Restore
          </Button>
        </div>
      </section>
    </main>
  );
}

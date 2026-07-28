import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEncryptedBackup } from "../backup/backupService";
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
  it("uses the dashboard as the first borrower-management route", async () => {
    render(<App dbName={nextDbName()} />);

    expect(screen.getByRole("heading", { name: "Interest Manager" })).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(await screen.findByText("Storage ready")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Borrowers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New borrower" })).toBeInTheDocument();
  });

  it("updates the connection status when the browser goes offline and online", async () => {
    render(<App dbName={nextDbName()} />);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(await screen.findByText("Offline")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(await screen.findByText("Online")).toBeInTheDocument();
  });

  it("creates a borrower and navigates to its persisted detail route", async () => {
    const user = userEvent.setup();
    render(<App dbName={nextDbName()} />);

    await user.click(screen.getByRole("button", { name: "New borrower" }));
    await user.type(screen.getByLabelText("Display name"), "Tran Thi B");
    await user.click(screen.getByRole("button", { name: "Save borrower" }));

    expect(await screen.findByRole("heading", { name: "Tran Thi B" })).toBeInTheDocument();
    expect(window.location.hash).toMatch(/^#\/borrowers\//);
  });

  it("downloads an encrypted backup when a passphrase is provided", async () => {
    const user = userEvent.setup();
    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | undefined;

    render(<App dbName={nextDbName()} />);

    await user.click(screen.getByRole("link", { name: "Settings" }));

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
      type: "system.smoke",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
      data: { note: "restored" },
    };
    const backup = await createEncryptedBackup([restoredRecord], "safe passphrase", { iterations: 1000 });
    const file = new File([JSON.stringify(backup)], "backup.json", { type: "application/json" });
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);

    render(<App dbName={nextDbName()} />);

    await user.click(screen.getByRole("link", { name: "Settings" }));

    await user.type(screen.getByLabelText("Restore passphrase"), "safe passphrase");
    await user.upload(screen.getByLabelText("Backup file"), file);

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("Replace local records with this backup?"));
    await waitFor(() => expect(screen.getByText("1 record")).toBeInTheDocument());
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
    window.location.hash = "#/borrowers/borrower-1";
    render(<App dbName={dbName} />);

    await screen.findByRole("heading", { name: "Pham Thi D" });
    await user.click(screen.getByRole("button", { name: "New loan" }));
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
  });
});

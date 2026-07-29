import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { vi } from "../../i18n/vi";
import { filterLoans, type LoanCollectionStatus } from "../domain/loanSelectors";
import type { Borrower, Loan, LoanStatus } from "../domain/types";
import { Button } from "../../ui/Button";
import { collectionStatusLabels, formatMoneyVnd, loanStatusLabels } from "./lendingLabels";

export interface BorrowerDetailProps {
  borrower: Borrower;
  loans: Loan[];
  collectionStatuses: Record<string, LoanCollectionStatus>;
  onBack(): void;
  onEdit(): void;
  onCreateLoan(): void;
  onSelectLoan(id: string): void;
}

export function BorrowerDetail({ borrower, loans, collectionStatuses, onBack, onEdit, onCreateLoan, onSelectLoan }: BorrowerDetailProps) {
  const [loanStatus, setLoanStatus] = useState<"all" | LoanStatus>("all");
  const [collectionStatus, setCollectionStatus] = useState<"all" | LoanCollectionStatus>("all");
  const filteredLoans = useMemo(() => {
    const loansForStatus = filterLoans({
      contexts: loans.map((loan) => ({ loan, entries: [], payments: [], promises: [], today: "9999-12-31" })),
      filter: { loanStatuses: loanStatus === "all" ? undefined : [loanStatus] },
    });
    return collectionStatus === "all"
      ? loansForStatus
      : loansForStatus.filter((loan) => collectionStatuses[loan.id] === collectionStatus);
  }, [collectionStatus, collectionStatuses, loanStatus, loans]);

  return (
    <section className="route-panel" aria-labelledby="borrower-heading">
      <div className="route-heading">
        <Button icon={<ArrowLeft aria-hidden="true" size={18} />} onClick={onBack}>{vi.borrower.title}</Button>
        <Button icon={<Pencil aria-hidden="true" size={18} />} onClick={onEdit}>{vi.borrower.edit}</Button>
        <Button icon={<Plus aria-hidden="true" size={18} />} variant="primary" onClick={onCreateLoan}>{vi.loan.new}</Button>
      </div>
      <h2 id="borrower-heading">{borrower.displayName}</h2>
      {borrower.phone ? <p>{borrower.phone}</p> : null}
      {borrower.note ? <p>{borrower.note}</p> : null}
      <p className="detail-status">{vi.status[borrower.status]}</p>
      <h3>{vi.borrower.loans}</h3>
      {loans.length === 0 ? <p className="empty-state">{vi.borrower.noLoans}</p> : <>
        <label className="field" htmlFor="loan-status-filter">
          <span>{vi.loan.loanStatusFilter}</span>
          <select id="loan-status-filter" value={loanStatus} onChange={(event) => setLoanStatus(event.target.value as "all" | LoanStatus)}>
            <option value="all">{vi.common.all}</option>
            {Object.entries(loanStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="collection-status-filter">
          <span>{vi.loan.collectionStatusFilter}</span>
          <select id="collection-status-filter" value={collectionStatus} onChange={(event) => setCollectionStatus(event.target.value as "all" | LoanCollectionStatus)}>
            <option value="all">{vi.common.all}</option>
            {Object.entries(collectionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {filteredLoans.length === 0 ? <p className="empty-state">{vi.borrower.noSearchResults}</p> : (
        <ul className="loan-list">
          {filteredLoans.map((loan) => (
            <li key={loan.id}>
              <button className="loan-link" type="button" onClick={() => onSelectLoan(loan.id)}>
                <span>{vi.loan.title}: {formatMoneyVnd(loan.originalPrincipal)}</span>
                <span>{loan.disbursementDate} đến {loan.maturityDate} ({vi.status[loan.status]})</span>
              </button>
            </li>
          ))}
        </ul>
        )}
      </>}
    </section>
  );
}

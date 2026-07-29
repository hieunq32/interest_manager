import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { vi } from "../../i18n/vi";
import type { Borrower, Loan } from "../domain/types";
import { Button } from "../../ui/Button";
import { formatMoneyVnd } from "./lendingLabels";

export interface BorrowerDetailProps {
  borrower: Borrower;
  loans: Loan[];
  onBack(): void;
  onEdit(): void;
  onCreateLoan(): void;
  onSelectLoan(id: string): void;
}

export function BorrowerDetail({ borrower, loans, onBack, onEdit, onCreateLoan, onSelectLoan }: BorrowerDetailProps) {
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
      {loans.length === 0 ? <p className="empty-state">{vi.borrower.noLoans}</p> : (
        <ul className="loan-list">
          {loans.map((loan) => (
            <li key={loan.id}>
              <button className="loan-link" type="button" onClick={() => onSelectLoan(loan.id)}>
                <span>{vi.loan.title}: {formatMoneyVnd(loan.originalPrincipal)}</span>
                <span>{loan.disbursementDate} đến {loan.maturityDate} ({vi.status[loan.status]})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

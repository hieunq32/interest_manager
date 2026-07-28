import { ArrowLeft, Pencil, Plus } from "lucide-react";
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
        <Button icon={<ArrowLeft aria-hidden="true" size={18} />} onClick={onBack}>Borrowers</Button>
        <Button icon={<Pencil aria-hidden="true" size={18} />} onClick={onEdit}>Edit borrower</Button>
        <Button icon={<Plus aria-hidden="true" size={18} />} variant="primary" onClick={onCreateLoan}>New loan</Button>
      </div>
      <h2 id="borrower-heading">{borrower.displayName}</h2>
      {borrower.phone ? <p>{borrower.phone}</p> : null}
      {borrower.note ? <p>{borrower.note}</p> : null}
      <p className="detail-status">{borrower.status}</p>
      <h3>Loans</h3>
      {loans.length === 0 ? <p className="empty-state">No loans for this borrower.</p> : (
        <ul className="loan-list">
          {loans.map((loan) => (
            <li key={loan.id}>
              <button className="loan-link" type="button" onClick={() => onSelectLoan(loan.id)}>
                <span>Loan: {formatMoneyVnd(loan.originalPrincipal)}</span>
                <span>{loan.disbursementDate} to {loan.maturityDate} ({loan.status})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { ChevronRight, Users } from "lucide-react";
import { vi } from "../../i18n/vi";
import type { Borrower } from "../domain/types";
import { Button } from "../../ui/Button";

export interface BorrowerListProps {
  borrowers: Borrower[];
  onSelect(id: string): void;
}

export function BorrowerList({ borrowers, onSelect }: BorrowerListProps) {
  if (borrowers.length === 0) {
    return <p className="empty-state">{vi.borrower.noBorrowers}</p>;
  }

  return (
    <ul className="borrower-list" aria-label={vi.borrower.title}>
      {borrowers.map((borrower) => (
        <li key={borrower.id}>
          <Button icon={<Users aria-hidden="true" size={18} />} onClick={() => onSelect(borrower.id)}>
            <span className="borrower-list-name">{borrower.displayName}</span>
            <span className="borrower-list-meta">{vi.status[borrower.status]}</span>
            <ChevronRight aria-hidden="true" size={18} />
          </Button>
        </li>
      ))}
    </ul>
  );
}

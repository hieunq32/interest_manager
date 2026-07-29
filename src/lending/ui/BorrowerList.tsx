import { ChevronRight, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { vi } from "../../i18n/vi";
import { filterBorrowers } from "../domain/loanSelectors";
import type { Borrower } from "../domain/types";
import { Button } from "../../ui/Button";
import { borrowerStatusLabels } from "./lendingLabels";

export interface BorrowerListProps {
  borrowers: Borrower[];
  onSelect(id: string): void;
}

export function BorrowerList({ borrowers, onSelect }: BorrowerListProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Borrower["status"]>("all");
  const filteredBorrowers = useMemo(
    () => filterBorrowers({ borrowers, query, status }),
    [borrowers, query, status],
  );

  if (borrowers.length === 0) {
    return <p className="empty-state">{vi.borrower.noBorrowers}</p>;
  }

  return (
    <div className="lending-form">
      <label className="field" htmlFor="borrower-search">
        <span>{vi.borrower.searchBorrower}</span>
        <input id="borrower-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label className="field" htmlFor="borrower-status-filter">
        <span>{vi.borrower.borrowerStatusFilter}</span>
        <select id="borrower-status-filter" value={status} onChange={(event) => setStatus(event.target.value as "all" | Borrower["status"])}>
          <option value="all">{vi.common.all}</option>
          {Object.entries(borrowerStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {filteredBorrowers.length === 0 ? <p className="empty-state">{vi.borrower.noSearchResults}</p> : <ul className="borrower-list" aria-label={vi.borrower.title}>
        {filteredBorrowers.map((borrower) => (
        <li key={borrower.id}>
          <Button icon={<Users aria-hidden="true" size={18} />} onClick={() => onSelect(borrower.id)}>
            <span className="borrower-list-name">{borrower.displayName}</span>
            <span className="borrower-list-meta">{borrowerStatusLabels[borrower.status]}</span>
            <ChevronRight aria-hidden="true" size={18} />
          </Button>
        </li>
        ))}
      </ul>}
    </div>
  );
}

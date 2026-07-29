import type { LoanSummary } from "../domain/ledger";
import { formatMoneyVnd } from "./lendingLabels";

export interface DashboardProps {
  summaries: LoanSummary[];
  onOpenLoan(id: string): void;
}

type DashboardSection = {
  title: string;
  tone: "due" | "upcoming" | "promised" | "overdue";
  count(summary: LoanSummary): number;
};

const sections: DashboardSection[] = [
  { title: "Due today", tone: "due", count: (summary) => summary.dueToday },
  { title: "Upcoming", tone: "upcoming", count: (summary) => summary.dueSoon },
  { title: "Promises", tone: "promised", count: (summary) => summary.promised },
  { title: "Overdue", tone: "overdue", count: (summary) => summary.overdue },
];

export function Dashboard({ summaries, onOpenLoan }: DashboardProps) {
  const outstandingPrincipal = summaries.reduce((total, summary) => total + summary.outstandingPrincipal, 0);
  const outstandingInterest = summaries.reduce((total, summary) => total + summary.outstandingInterest, 0);

  return (
    <section className="dashboard" aria-labelledby="dashboard-heading">
      <div className="route-heading">
        <h2 id="dashboard-heading">Dashboard</h2>
        <span className="detail-status">{summaries.length} active loans</span>
      </div>
      <section className="dashboard-totals" aria-label="Active-loan totals">
        <p>Outstanding principal: {formatMoneyVnd(outstandingPrincipal)}</p>
        <p>Outstanding interest: {formatMoneyVnd(outstandingInterest)}</p>
      </section>
      <div className="dashboard-sections">
        {sections.map((section) => {
          const matchingSummaries = summaries.filter((summary) => section.count(summary) > 0);
          return <section className="dashboard-section" key={section.title} aria-labelledby={`${section.tone}-heading`}>
            <h3 id={`${section.tone}-heading`}>{section.title}</h3>
            {matchingSummaries.length === 0
              ? <p className="empty-state">No loans in this section.</p>
              : <ul className="dashboard-list">
                {matchingSummaries.map((summary) => <li key={summary.loanId}>
                  <button className="dashboard-row" type="button" onClick={() => onOpenLoan(summary.loanId)}>
                    <span>Open loan {summary.loanId}</span>
                    <span className={`dashboard-count dashboard-count-${section.tone}`}>{section.count(summary)} {section.title.toLowerCase()}</span>
                  </button>
                </li>)}
              </ul>}
          </section>;
        })}
      </div>
    </section>
  );
}

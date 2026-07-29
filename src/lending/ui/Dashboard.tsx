import type { LoanSummary } from "../domain/ledger";
import { vi } from "../../i18n/vi";
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

const dashboardLabels = {
  title: "Tổng quan",
  dueToday: `${vi.status.due} hôm nay`,
  openLoan: "Mở khoản vay",
  emptySection: "Không có khoản vay trong mục này.",
};

const sections: DashboardSection[] = [
  { title: dashboardLabels.dueToday, tone: "due", count: (summary) => summary.dueToday },
  { title: vi.status.upcoming, tone: "upcoming", count: (summary) => summary.dueSoon },
  { title: vi.status.promised, tone: "promised", count: (summary) => summary.promised },
  { title: vi.status.overdue, tone: "overdue", count: (summary) => summary.overdue },
];

export function Dashboard({ summaries, onOpenLoan }: DashboardProps) {
  const outstandingPrincipal = summaries.reduce((total, summary) => total + summary.outstandingPrincipal, 0);
  const outstandingInterest = summaries.reduce((total, summary) => total + summary.outstandingInterest, 0);

  return (
    <section className="dashboard" aria-labelledby="dashboard-heading">
      <div className="route-heading">
        <h2 id="dashboard-heading">{dashboardLabels.title}</h2>
        <span className="detail-status">{summaries.length} {vi.loan.title.toLowerCase()} {vi.status.active.toLowerCase()}</span>
      </div>
      <section className="dashboard-totals" aria-label={`${vi.status.active} ${vi.loan.title}`}>
        <p>{vi.loan.outstandingPrincipal}: {formatMoneyVnd(outstandingPrincipal)}</p>
        <p>{vi.loan.outstandingInterest}: {formatMoneyVnd(outstandingInterest)}</p>
      </section>
      <div className="dashboard-sections">
        {sections.map((section) => {
          const matchingSummaries = summaries.filter((summary) => section.count(summary) > 0);
          return <section className="dashboard-section" key={section.title} aria-labelledby={`${section.tone}-heading`}>
            <h3 id={`${section.tone}-heading`}>{section.title}</h3>
            {matchingSummaries.length === 0
              ? <p className="empty-state">{dashboardLabels.emptySection}</p>
              : <ul className="dashboard-list">
                {matchingSummaries.map((summary) => <li key={summary.loanId}>
                  <button className="dashboard-row" type="button" onClick={() => onOpenLoan(summary.loanId)}>
                    <span>{dashboardLabels.openLoan} {summary.loanId}</span>
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

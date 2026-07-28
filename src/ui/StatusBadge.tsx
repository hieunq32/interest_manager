type StatusBadgeProps = {
  tone: "ok" | "warn" | "error";
  children: string;
};

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

/** The report form's room while it streams in (messaging spec 3.4). */
export function ReportSkeleton() {
  return (
    <div className="report-column" aria-hidden="true">
      <span className="skeleton composer-skeleton-crumb" />
      <span className="skeleton composer-skeleton-title" />
      <span className="skeleton report-skeleton-form" />
    </div>
  );
}

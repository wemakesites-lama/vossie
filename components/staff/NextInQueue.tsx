import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { NavPending } from "@/components/ui/NavPending";
import { FORWARD } from "@/lib/motion";

type NextInQueueProps = {
  /** "Next waiting shop" or "Next open report". */
  label: string;
  next: { title: string; href: string } | null;
  /** What to say when nothing else waits. */
  none: string;
};

/**
 * The next thing to do from a shop or report page (role views spec 7.2, N3 plan decision 9): the oldest open item that
 * isn't this one, one level deeper, never prefetched (staff pages read the session).
 */
export function NextInQueue({ label, next, none }: NextInQueueProps) {
  if (!next) return <p className="staff-next staff-muted">{none}</p>;
  return (
    <p className="staff-next">
      <Link href={next.href} prefetch={false} transitionTypes={FORWARD} className="staff-next-link">
        <span className="staff-next-label">{label}:</span> {next.title}
        <ChevronRightIcon />
        <NavPending />
      </Link>
    </p>
  );
}

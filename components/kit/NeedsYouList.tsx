import Link from "next/link";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import type { Tone } from "./Pill";
import { NavPending } from "@/components/ui/NavPending";
import { FORWARD } from "@/lib/motion";

export type NeedsYouItem = {
  key: string;
  count: number;
  title: string;
  detail?: string;
  /** How long the oldest has waited, worked out by the caller at request time in SAST. */
  age?: { label: string; tone: Extract<Tone, "info" | "warning" | "danger"> };
  href: string;
  /** Navy count: someone is waiting on you. Otherwise pale. */
  urgent?: boolean;
  /** Show the row at 0 too (the admin's Hidden). */
  keepWhenZero?: boolean;
};

type NeedsYouListProps = { label: string; items: readonly NeedsYouItem[]; allClear: string };

/**
 * What needs this person now, most urgent first as the caller orders it (role views spec 5.2). Each row is one link
 * that goes deeper (nav-forward). With nothing waiting, one "All clear" line.
 */
export function NeedsYouList({ label, items, allClear }: NeedsYouListProps) {
  const shown = items.filter((item) => item.count > 0 || item.keepWhenZero);
  if (shown.every((item) => item.count === 0)) {
    return (
      <p className="needs-clear">
        <CheckIcon /> {allClear}
      </p>
    );
  }
  return (
    <ul aria-label={label} className="needs-list">
      {shown.map((item) => (
        <li key={item.key}>
          <Link href={item.href} prefetch={false} transitionTypes={FORWARD} className="needs-row">
            <span className="needs-count" data-urgent={item.urgent ? "" : undefined}>
              {item.count > 99 ? "99+" : item.count}
            </span>
            <span className="needs-text">
              <span className="needs-title">{item.title}</span>{" "}
              {item.detail && <span className="needs-detail">{item.detail}</span>}
            </span>
            {item.age && (
              <span className="needs-age" data-tone={item.age.tone}>
                {/* "26h" alone is unclear when read aloud. */}
                <span className="sr-only">oldest waiting </span>
                {item.age.label}
              </span>
            )}
            <ChevronRightIcon className="needs-chevron" />
            <NavPending />
          </Link>
        </li>
      ))}
    </ul>
  );
}

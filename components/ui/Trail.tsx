import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { NavPending } from "@/components/ui/NavPending";
import { BACK } from "@/lib/motion";
import type { Crumb } from "@/lib/nav/trail";

/**
 * The breadcrumb trail (wayfinding spec 3.1), from `trailFor`: one ordered list. On phones only the parent shows, as a
 * back link ("‹ Reports"); from the tablet step the whole trail, the page itself last and unlinked. Every link goes up,
 * so every link slides back. A top-level page's trail is empty and renders nothing.
 */
export function Trail({ crumbs }: { crumbs: readonly Crumb[] }) {
  if (crumbs.length < 2) return null;
  const parent = crumbs.length - 2;
  return (
    <nav aria-label="Breadcrumb" className="trail">
      <ol>
        {crumbs.map((crumb, index) => (
          <li key={`${index}-${crumb.label}`} className={index === parent ? "trail-parent" : undefined}>
            {crumb.href === null ? (
              <span aria-current="page" className="trail-here">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} prefetch={false} transitionTypes={BACK} className="trail-link">
                {index === parent && <ChevronLeftIcon className="trail-chevron" />}
                {/* The space sits outside the sr-only span: name computation trims each element's own text. */}
                {index === parent && <span className="sr-only">Back to</span>}{" "}
                <span className="trail-label">{crumb.label}</span>
                <NavPending />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

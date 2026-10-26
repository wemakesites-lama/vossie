import Link from "next/link";
import { useId, type ReactNode } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { NavPending } from "@/components/ui/NavPending";
import { FORWARD } from "@/lib/motion";

type Lead =
  | { kind: "initials"; text: string }
  | { kind: "icon"; icon: ReactNode }
  | { kind: "thumb"; node: ReactNode };

type ListRowProps = {
  href: string;
  lead: Lead;
  title: string;
  detail?: string;
  pill?: ReactNode;
  meta?: string;
  /** The link's own name ("Edit Desk fan"); the detail is then its description (role views N2 plan decision 12). */
  label?: string;
  /** Forms and links beside the row, outside its link (My listings' Pause, Mark sold, Delete). */
  actions?: ReactNode;
};

/** "Tech corner" → "TC"; one word → its first two letters. */
export function initialsOf(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}

/** A row in a list (role views spec 5.2): one link, at least 56px tall, that goes deeper. Render it inside a <ul>. */
export function ListRow({ href, lead, title, detail, pill, meta, label, actions }: ListRowProps) {
  const detailId = useId();
  return (
    <li className={actions ? "list-row-item" : undefined}>
      <Link
        href={href}
        prefetch={false}
        transitionTypes={FORWARD}
        className="list-row"
        aria-label={label}
        aria-describedby={label && detail ? detailId : undefined}
      >
        <span className="list-row-lead" aria-hidden="true">
          {lead.kind === "initials" ? initialsOf(lead.text) : lead.kind === "icon" ? lead.icon : lead.node}
        </span>
        <span className="list-row-text">
          <span className="list-row-title">{title}</span>{" "}
          {detail && (
            <span id={detailId} className="list-row-detail">
              {detail}
            </span>
          )}
        </span>
        {pill}
        {meta && <span className="list-row-meta">{meta}</span>}
        <ChevronRightIcon className="needs-chevron" />
        <NavPending />
      </Link>
      {actions && <div className="list-row-actions">{actions}</div>}
    </li>
  );
}

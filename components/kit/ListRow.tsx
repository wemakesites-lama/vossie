import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/icons";

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
};

/** "Tech corner" → "TC"; one word → its first two letters. */
export function initialsOf(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}

/** A row in a list (role views spec 5.2): one link, at least 56px tall, that goes deeper. Render it inside a <ul>. */
export function ListRow({ href, lead, title, detail, pill, meta }: ListRowProps) {
  return (
    <li>
      <Link href={href} prefetch={false} transitionTypes={["nav-forward"]} className="list-row">
        <span className="list-row-lead" aria-hidden="true">
          {lead.kind === "initials" ? initialsOf(lead.text) : lead.kind === "icon" ? lead.icon : lead.node}
        </span>
        <span className="list-row-text">
          <span className="list-row-title">{title}</span>{" "}
          {detail && <span className="list-row-detail">{detail}</span>}
        </span>
        {pill}
        {meta && <span className="list-row-meta">{meta}</span>}
        <ChevronRightIcon className="needs-chevron" />
      </Link>
    </li>
  );
}

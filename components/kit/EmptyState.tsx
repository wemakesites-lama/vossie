import Link from "next/link";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  line: string;
  action: { label: string; href: string };
};

/** What an empty list says (spec 5.2): an icon, an action title, one line, one primary button. */
export function EmptyState({ icon, title, line, action }: EmptyStateProps) {
  return (
    <div className="kit-empty">
      <span className="kit-empty-icon">{icon}</span>
      <h3 className="kit-empty-title">{title}</h3>
      <p>{line}</p>
      <Link href={action.href} prefetch={false} className="btn btn-primary">
        {action.label}
      </Link>
    </div>
  );
}

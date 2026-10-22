import Link from "next/link";
import { useId, type ReactNode } from "react";

type Action = { label: string; href: string };

type SectionHeaderProps = {
  title: string;
  level: 2 | 3;
  count?: number;
  action?: Action;
  id?: string;
};

/** A card's title row (spec 5.2): the heading, an optional count, an optional "Manage ›" link in sky-dark. */
export function SectionHeader({ title, level, count, action, id }: SectionHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="kit-section-header">
      <Heading id={id} className="kit-section-title">
        {title}
        {count !== undefined && <span className="kit-section-count"> {count}</span>}
      </Heading>
      {action && (
        <Link href={action.href} prefetch={false} className="kit-section-action">
          {action.label}
        </Link>
      )}
    </div>
  );
}

type CardProps = {
  title?: string;
  level?: 2 | 3;
  count?: number;
  action?: Action;
  children: ReactNode;
};

/** A white card on the panel background (spec 5.2). With a title it's a named region; without, a plain block. */
export function Card({ title, level = 2, count, action, children }: CardProps) {
  const id = useId();
  if (!title) return <div className="kit-card">{children}</div>;
  return (
    <section aria-labelledby={id} className="kit-card">
      <SectionHeader id={id} title={title} level={level} count={count} action={action} />
      {children}
    </section>
  );
}

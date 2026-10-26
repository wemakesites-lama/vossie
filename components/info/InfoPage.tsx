import type { ReactNode } from "react";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";
import { longSastDate } from "@/lib/time";

export type InfoSection = {
  /**
   * The section's address and its link in "On this page". It must be unique across every info page: Next keeps the last
   * few pages hidden in the DOM, and a `#` link or an aria-labelledby finds the first match (plan decision 3).
   */
  id: string;
  title: string;
  children: ReactNode;
};

type InfoPageProps = {
  /** The page's route, for its breadcrumb trail (wayfinding spec 3.1). */
  route: string;
  title: string;
  /** One line under the title. */
  lede: string;
  /** When the text last changed, as YYYY-MM-DD. */
  updated: string;
  /** Legal drafts say so in a banner, in words (spec 2.1 and section 6). */
  draft?: boolean;
  sections: readonly InfoSection[];
};

/**
 * The frame every info and legal page shares (spec 2.5): the title, a one-line lede, when it last changed, the draft
 * banner when there is one, then "On this page" and the sections. The list is a row of pills under the lede on phones
 * and tablets, and a column on the left from the desktop step. The text keeps to about 65 characters a line.
 */
export function InfoPage({ route, title, lede, updated, draft = false, sections }: InfoPageProps) {
  return (
    <div className="page info-page">
      <Trail crumbs={trailFor(route, { names: { [route]: title } })} />
      <h1 className="info-title">{title}</h1>
      <p className="info-lede">{lede}</p>
      <p className="info-updated">
        Last updated <time dateTime={updated}>{longSastDate(updated)}</time>
      </p>
      {draft && (
        <p role="note" className="info-draft">
          <strong>Draft for Eduvos to review.</strong> Not yet in force.
        </p>
      )}
      <div className="info-layout">
        <nav aria-label="On this page" className="info-toc">
          <p className="info-toc-label" aria-hidden="true">
            On this page
          </p>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="info-body">
          {sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="info-section">
              <h2 id={`${section.id}-title`} className="info-section-title">
                {section.title}
              </h2>
              {section.children}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

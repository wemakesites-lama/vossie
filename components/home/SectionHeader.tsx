import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type SectionHeaderProps = {
  /** The H2 gets the id `${id}-title`, which the section's aria-labelledby points at. */
  id: string;
  eyebrow: string;
  /** The large heading. Without it, the eyebrow itself is the section's H2. */
  title?: string;
  /**
   * "navy" on grey and pale panels, where sky-dark fails contrast. "sky" on a sky panel: navy in every theme, since
   * the navy token turns white in the dark themes and white on sky fails.
   */
  tone?: "default" | "navy" | "sky";
  align?: "start" | "center";
  /** `context` is read after the label by screen readers only, e.g. " new listings". */
  link?: { href: string; label: string; context?: string };
  /** Extra controls beside the link, such as the Just listed switch. */
  children?: ReactNode;
};

/** A section's eyebrow, heading and "See all" link (spec section 7). */
export function SectionHeader({ id, eyebrow, title, tone = "default", align = "start", link, children }: SectionHeaderProps) {
  const eyebrowClass = cx("eyebrow", tone === "navy" && "text-navy", tone === "sky" && "text-on-sky");
  return (
    <div className={cx("section-head", align === "center" && "section-head-center")}>
      <div>
        {title ? (
          <>
            <p className={eyebrowClass}>{eyebrow}</p>
            <h2 id={`${id}-title`} tabIndex={-1} className="section-title">
              {title}
            </h2>
          </>
        ) : (
          <h2 id={`${id}-title`} tabIndex={-1} className={eyebrowClass}>
            {eyebrow}
          </h2>
        )}
      </div>
      {(link || children) && (
        <div className="section-head-side">
          {children}
          {link && (
            <Link href={link.href} className="section-link">
              {link.label}
              {/* The space sits outside the span because name computation (jsdom's, at least) trims each element's own text. */}
              {link.context && (
                <>
                  {" "}
                  <span className="sr-only">{link.context.trimStart()}</span>
                </>
              )}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

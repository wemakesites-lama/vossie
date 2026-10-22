import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "./Pill";

type BannerProps = {
  tone: Exclude<Tone, "live">;
  icon: ReactNode;
  children: ReactNode;
  action?: { label: string; href: string };
};

/** A tinted panel with one sentence and at most one link (spec 5.2). */
export function Banner({ tone, icon, children, action }: BannerProps) {
  return (
    <div className="kit-banner" data-tone={tone}>
      <span className="kit-banner-icon">{icon}</span>
      <p>
        {children}
        {action && (
          <>
            {" "}
            <Link href={action.href} prefetch={false}>
              {action.label}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

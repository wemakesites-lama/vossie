import Link from "next/link";
import type { ReactNode } from "react";
import { NavPending } from "@/components/ui/NavPending";
import { BACK } from "@/lib/motion";

type ComingSoonProps = {
  title: string;
  children?: ReactNode;
};

/** Body for pages that arrive in a later stage (spec section 14). */
export function ComingSoon({ title, children }: ComingSoonProps) {
  return (
    <section aria-labelledby="page-title" className="mx-auto w-full max-w-page px-4 pb-8 pt-16 wide:px-8 wide:pt-24">
      <p className="eyebrow">Coming in the next stage</p>
      <h1 id="page-title" className="mt-3 font-display text-section uppercase text-navy">
        {title}
      </h1>
      <div className="mt-4 max-w-[60ch] text-muted">{children ?? "This page arrives in the next build stage."}</div>
      <Link href="/" transitionTypes={BACK} className="btn btn-primary mt-8">
        Back to the homepage
        <NavPending />
      </Link>
    </section>
  );
}

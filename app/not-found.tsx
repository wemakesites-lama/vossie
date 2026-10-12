import type { Metadata } from "next";
import Link from "next/link";

// The tab reads "Page not found · Vossie": the layout adds the suffix.
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section aria-labelledby="page-title" className="mx-auto w-full max-w-page px-4 pb-8 pt-16 wide:px-8 wide:pt-24">
      <p className="eyebrow">Page not found</p>
      <h1 id="page-title" className="mt-3 font-display text-section uppercase text-navy">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-4 max-w-[60ch] text-muted">The link may be old, or the page may not exist yet.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">
          Back to the homepage
        </Link>
        <Link href="/browse" className="btn btn-outline text-navy">
          Browse everything
        </Link>
      </div>
    </section>
  );
}

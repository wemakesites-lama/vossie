import type { Metadata } from "next";
import { BookSlot, BookSlotSkeleton } from "@/components/hub/BookSlot";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";

/** A page for one student's request, so search engines leave it out (robots.txt too). */
export const metadata: Metadata = { title: "Request a slot", robots: { index: false } };

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no post. */
export function generateStaticParams() {
  return [{ id: "h-sample" }];
}

/** Request a slot (staff tools spec 2.5). Everything needs the session, so it streams in behind a skeleton. */
export default function BookSlotPage({ params }: PageProps<"/hub/[id]/book">) {
  return (
    <PageTransition>
      <div className="page hub-book-page">
        <Reveal fallback={<BookSlotSkeleton />}>
          <BookSlot params={params} />
        </Reveal>
      </div>
    </PageTransition>
  );
}

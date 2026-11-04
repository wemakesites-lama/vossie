import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { PhotoSearch, PhotoSearchSkeleton } from "@/components/search/PhotoSearch";
import { Trail } from "@/components/ui/Trail";
import { aiFeatureOn } from "@/lib/ai/config";
import { trailFor } from "@/lib/nav/trail";

/** One person's form, so search engines leave it out. */
export const metadata: Metadata = { title: "Search with a photo", robots: { index: false } };

/**
 * Snap to search (AI features spec section 5). The trail, heading and line are the static shell; who's signed in
 * streams inside <Suspense>. With the switch off there is no page (planning decision 4).
 */
export default function PhotoSearchPage() {
  if (!aiFeatureOn("photo-search")) notFound();
  return (
    <PageTransition>
      <div className="page photo-search-page">
        <div className="photo-search-column">
          <Trail crumbs={trailFor("/browse/photo")} />
          <h1 className="photo-search-title">Search with a photo</h1>
          <p className="photo-search-lede">
            Take or choose a photo of what you want. We&apos;ll search CampusCart for it.
          </p>
          <Reveal fallback={<PhotoSearchSkeleton />}>
            <PhotoSearch />
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
}

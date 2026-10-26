import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { SavedSkeleton } from "@/components/saved/SavedSkeleton";
import { SavedTabs } from "@/components/saved/SavedTabs";

/** Saved belongs to one device, so search engines leave it out (shopping spec 5.4). */
export const metadata: Metadata = { title: "Saved", robots: { index: false } };

/**
 * Saved (shopping spec 5; community actions spec 2.17). The heading is prerendered; the tabs read `?tab=`, and the
 * lists read the saved cookie or the session, so they stream in together behind a skeleton (plan decision 17).
 */
export default function SavedPage({ searchParams }: PageProps<"/saved">) {
  return (
    <PageTransition>
      <div className="page saved-page">
        <h1 className="saved-title">Saved</h1>
        <Reveal fallback={<SavedSkeleton />}>
          <SavedTabs searchParams={searchParams} />
        </Reveal>
      </div>
    </PageTransition>
  );
}

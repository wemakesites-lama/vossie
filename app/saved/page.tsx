import type { Metadata } from "next";
import { Suspense } from "react";
import { SavedList } from "@/components/saved/SavedList";
import { SavedSkeleton } from "@/components/saved/SavedSkeleton";

/** Saved belongs to one device, so search engines leave it out (shopping spec 5.4). */
export const metadata: Metadata = { title: "Saved", robots: { index: false } };

/**
 * Saved (shopping spec 5). The heading and device note are prerendered; the count and the list read the saved cookie
 * on each request, so they stream in behind a skeleton (plan decision 1).
 */
export default function SavedPage() {
  return (
    <div className="page saved-page">
      <h1 className="saved-title">Saved</h1>
      <p className="saved-note">Saved on this device. Once Vossie is live, your saves will follow your account to any device.</p>
      <Suspense fallback={<SavedSkeleton />}>
        <SavedList />
      </Suspense>
    </div>
  );
}

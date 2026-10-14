import type { Metadata } from "next";
import { Suspense } from "react";
import { HubFeed } from "@/components/hub/HubFeed";
import { HubFeedSkeleton } from "@/components/hub/HubFeedSkeleton";
import { HubStory } from "@/components/hub/HubStory";
import { VerifiedSellers } from "@/components/hub/VerifiedSellers";
import { getCampuses, getHubBanner, getVerifiedSellers } from "@/lib/data";

/** Fixed: `?type=` views share the Hub's title and description, and stay indexed (plan decision 14). */
export const metadata: Metadata = {
  title: "The Incubation Hub",
  description:
    "The Eduvos Incubation Hub backs student businesses: its Verified sellers, and its events, office hours and tips.",
};

/**
 * The Incubation Hub (community spec 5.1). The story and the Verified sellers are prerendered; the feed reads `?type=`
 * and today's date, so it streams in behind a skeleton.
 */
export default async function HubPage({ searchParams }: PageProps<"/hub">) {
  const [banner, sellers, campuses] = await Promise.all([
    getHubBanner(),
    getVerifiedSellers().catch(() => null),
    getCampuses(),
  ]);
  return (
    <div className="page hub-page">
      <HubStory image={banner.image} />
      <VerifiedSellers sellers={sellers} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />
      {/* The tabs link to #hub-feed, so a tap keeps the feed in view (plan decision 6). */}
      <section id="hub-feed" aria-labelledby="hub-feed-title" className="hub-feed">
        <h2 id="hub-feed-title" className="listing-section-title">
          What’s on and what’s new
        </h2>
        <Suspense fallback={<HubFeedSkeleton />}>
          <HubFeed searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { HubFeed } from "@/components/hub/HubFeed";
import { HubFeedSkeleton } from "@/components/hub/HubFeedSkeleton";
import { HubIntro } from "@/components/hub/HubIntro";
import { VerifiedShops } from "@/components/hub/VerifiedShops";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { getCampuses, getVerifiedSellers } from "@/lib/data";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

/** Fixed: `?type=` views share Launchpad's title and description, and stay indexed (plan decision 14). */
export const metadata: Metadata = {
  title: "Launchpad",
  description:
    "Free help for Eduvos student businesses: mentors, office hours, events and tips, and the shops the Incubation Hub has verified.",
};

/**
 * Launchpad (Launchpad spec 4): the intro, then Coming up and Tips, then Verified shops and who runs it. The intro and
 * the shops are prerendered; Coming up and Tips read `?type=` and today's date, so they stream in behind a skeleton.
 */
export default async function HubPage({ searchParams }: PageProps<"/hub">) {
  const [sellers, campuses] = await Promise.all([getVerifiedSellers().catch(() => null), getCampuses()]);
  return (
    <PageTransition>
      <div className="page hub-page">
        <Trail crumbs={trailFor("/hub")} />
        <HubIntro />
        <Reveal fallback={<HubFeedSkeleton />}>
          <HubFeed searchParams={searchParams} />
        </Reveal>
        <VerifiedShops sellers={sellers} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />
        <p className="hub-credit">Launchpad is run by the Eduvos Incubation Hub, the team behind CampusCart.</p>
      </div>
    </PageTransition>
  );
}

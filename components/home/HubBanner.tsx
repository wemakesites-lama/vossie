import Link from "next/link";
import { Suspense } from "react";
import { getHubBanner } from "@/lib/data";
import { Photo } from "@/components/listings/Photo";
import { EventsSkeleton, WhatsOnEvents } from "./WhatsOn";

/** The Hub banner and What's on (spec 7.13): full width, sitting on the footer. */
export async function HubBanner() {
  const banner = await getHubBanner();
  return (
    <section aria-labelledby="hub-title" className="hub-banner">
      <div className="hub-banner-inner">
        <div className="hub-banner-text">
          {/* Decorative, and not loaded at all with data saver on (plan decision 8). */}
          <div className="hub-banner-media" aria-hidden="true">
            <Photo image={{ src: banner.image.src, alt: "" }} sizes="100vw" className="hub-banner-photo" />
          </div>
          <p className="hub-banner-label">The Eduvos Incubation Hub</p>
          <h2 id="hub-title" className="hub-banner-title">
            Built for student hustles, backed by the Hub
          </h2>
          <p className="hub-banner-copy">
            CampusCart is run by the Eduvos Incubation Hub. Mentors help sellers grow, and the Hub runs pitch nights,
            workshops and office hours on every campus.
          </p>
          <Link href="/hub" className="btn btn-sky hub-banner-action">
            Our story
          </Link>
        </div>
        <div id="whats-on" className="whats-on">
          <h3 className="whats-on-title">What’s on</h3>
          <Suspense fallback={<EventsSkeleton />}>
            <WhatsOnEvents />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

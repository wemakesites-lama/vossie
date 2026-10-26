import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Composer } from "@/components/messages/Composer";
import { ComposerSkeleton } from "@/components/messages/ComposerSkeleton";
import { getListingIds } from "@/lib/data";
import { composerSubject } from "@/lib/messaging/subjects";
import { atLeastOne, PLACEHOLDER_PARAMS } from "@/lib/static-params";

/** "Message Tech corner · Vossie"; a page for one visitor, so search engines leave it out (plan decision 24). */
export async function generateMetadata({ params }: PageProps<"/listings/[id]/message">): Promise<Metadata> {
  const { id } = await params;
  const subject = await composerSubject({ kind: "listing", listingId: id });
  return { title: subject ? `Message ${subject.seller.name}` : "Page not found", robots: { index: false } };
}

/** One sample listing, so the build checks the request-time parts sit inside <Suspense> (plan decision 25). */
/** One listing's composer frame; on an empty database, a placeholder whose page is the 404 (2b plan Task 17b). */
export async function generateStaticParams() {
  return atLeastOne(
    (await getListingIds()).slice(0, 1).map((id) => ({ id })),
    PLACEHOLDER_PARAMS.listing,
  );
}

/** The composer for a listing (messaging spec 2.1 and 3.1). Everything after the frame needs the session. */
export default function ListingComposerPage({ params }: PageProps<"/listings/[id]/message">) {
  return (
    <PageTransition>
      <div className="page composer-page">
        <Reveal fallback={<ComposerSkeleton />}>
          <ListingComposer params={params} />
        </Reveal>
      </div>
    </PageTransition>
  );
}

async function ListingComposer({ params }: Pick<PageProps<"/listings/[id]/message">, "params">) {
  const { id } = await params;
  return <Composer target={{ kind: "listing", listingId: id }} />;
}

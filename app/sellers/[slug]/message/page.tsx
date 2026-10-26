import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Composer } from "@/components/messages/Composer";
import { ComposerSkeleton } from "@/components/messages/ComposerSkeleton";
import { getSellerSlugs } from "@/lib/data";
import { composerSubject } from "@/lib/messaging/subjects";
import { atLeastOne, PLACEHOLDER_PARAMS } from "@/lib/static-params";

/** "Message Tech corner · Vossie"; kept out of search engines (plan decision 24). */
export async function generateMetadata({ params }: PageProps<"/sellers/[slug]/message">): Promise<Metadata> {
  const { slug } = await params;
  const subject = await composerSubject({ kind: "shop", sellerSlug: slug });
  return { title: subject ? `Message ${subject.seller.name}` : "Page not found", robots: { index: false } };
}

/** One sample shop, so the build checks the request-time parts sit inside <Suspense> (plan decision 25). */
/** One shop's composer frame; on an empty database, a placeholder whose page is the 404 (2b plan Task 17b). */
export async function generateStaticParams() {
  return atLeastOne(
    (await getSellerSlugs()).slice(0, 1).map((slug) => ({ slug })),
    PLACEHOLDER_PARAMS.seller,
  );
}

/** A question to a shop, from its storefront (messaging spec 3.6, plan decision 2). */
export default function ShopComposerPage({ params }: PageProps<"/sellers/[slug]/message">) {
  return (
    <PageTransition>
      <div className="page composer-page">
        <Reveal fallback={<ComposerSkeleton />}>
          <ShopComposer params={params} />
        </Reveal>
      </div>
    </PageTransition>
  );
}

async function ShopComposer({ params }: Pick<PageProps<"/sellers/[slug]/message">, "params">) {
  const { slug } = await params;
  return <Composer target={{ kind: "shop", sellerSlug: slug }} />;
}

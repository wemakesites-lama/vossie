import type { Metadata } from "next";
import { Suspense } from "react";
import { Composer } from "@/components/messages/Composer";
import { ComposerSkeleton } from "@/components/messages/ComposerSkeleton";
import { getSellerSlugs } from "@/lib/data";
import { composerSubject } from "@/lib/messaging/subjects";

/** "Message Tech corner · Vossie"; kept out of search engines (plan decision 24). */
export async function generateMetadata({ params }: PageProps<"/sellers/[slug]/message">): Promise<Metadata> {
  const { slug } = await params;
  const subject = await composerSubject({ kind: "shop", sellerSlug: slug });
  return { title: subject ? `Message ${subject.seller.name}` : "Page not found", robots: { index: false } };
}

/** One sample shop, so the build checks the request-time parts sit inside <Suspense> (plan decision 25). */
export async function generateStaticParams() {
  return (await getSellerSlugs()).slice(0, 1).map((slug) => ({ slug }));
}

/** A question to a shop, from its storefront (messaging spec 3.6, plan decision 2). */
export default function ShopComposerPage({ params }: PageProps<"/sellers/[slug]/message">) {
  return (
    <div className="page composer-page">
      <Suspense fallback={<ComposerSkeleton />}>
        <ShopComposer params={params} />
      </Suspense>
    </div>
  );
}

async function ShopComposer({ params }: Pick<PageProps<"/sellers/[slug]/message">, "params">) {
  const { slug } = await params;
  return <Composer target={{ kind: "shop", sellerSlug: slug }} />;
}

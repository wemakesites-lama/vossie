import type { Metadata } from "next";
import Link from "next/link";
import { StarterSkeleton, StarterView } from "@/components/browse/StarterPack";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Trail } from "@/components/ui/Trail";
import { aiFeatureOn } from "@/lib/ai/config";
import { trailFor } from "@/lib/nav/trail";

/** A page with a sentence is one person's pack, so search engines leave it out (planning decision 13). */
export async function generateMetadata({ searchParams }: PageProps<"/browse/starter">): Promise<Metadata> {
  // Off, the page is static: its metadata never reads the request.
  if (!aiFeatureOn("starter-pack")) return { title: "Get a starter pack" };
  const { q } = await searchParams;
  return { title: "Get a starter pack", robots: q ? { index: false } : undefined };
}

/**
 * Starter pack (AI round two spec section 6). The trail, heading and line are the static shell; the form and the pack
 * read the link and the campus cookie, so they stream in behind a skeleton no taller than the form. With the switch off
 * the page is static: one line and a way to Shop, no form (planning decision 10).
 */
export default function StarterPage({ searchParams }: PageProps<"/browse/starter">) {
  const on = aiFeatureOn("starter-pack");
  return (
    <PageTransition>
      <div className="page starter-page">
        <div className="starter-column">
          <Trail crumbs={trailFor("/browse/starter")} />
          <h1 className="starter-title">Get a starter pack</h1>
          {on ? (
            <>
              <p className="starter-lede">
                Tell us what you need in one sentence. We&apos;ll pick the cheapest listings that fit your budget.
              </p>
              <Reveal fallback={<StarterSkeleton />}>
                <StarterView searchParams={searchParams} />
              </Reveal>
            </>
          ) : (
            <p className="starter-lede">
              Starter packs aren&apos;t on right now.{" "}
              <Link href="/browse" prefetch={false} className="starter-link">
                Search Shop
              </Link>
            </p>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

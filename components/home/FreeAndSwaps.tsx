import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getCampuses, getFreeAndSwaps } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { cx } from "@/lib/cx";
import type { FreeSwapItem } from "@/lib/types";
import { Carousel } from "./Carousel";
import { Photo } from "@/components/listings/Photo";
import { SectionError } from "./SectionError";
import { SectionHeader } from "./SectionHeader";

// Browse filters are settled with the browse page (a placeholder in this stage); this one asks for both kinds.
const SEE_ALL = { href: "/browse?deals=free-and-swaps", label: "See all", context: " free and swap items" };

/** Free & swaps (spec 7.12): giveaways and swap-only items, the visitor's campus first. */
export function FreeAndSwaps() {
  return (
    <Suspense fallback={<FreeAndSwapsSkeleton />}>
      <FreeAndSwapsContent />
    </Suspense>
  );
}

export async function FreeAndSwapsContent() {
  const { campus } = await getViewerContext();
  const data = await Promise.all([getFreeAndSwaps({ campus, limit: 8 }), getCampuses()]).catch(() => null);
  if (!data) {
    return (
      <FreeAndSwapsFrame>
        <Header />
        <SectionError id="free-swaps" title="Free & swaps" />
      </FreeAndSwapsFrame>
    );
  }

  const [items, campuses] = data;
  // Spec 7.12: with nothing to show, the section hides.
  if (items.length === 0) return null;
  const names = new Map(campuses.map((item) => [item.slug, item.name]));

  return (
    <FreeAndSwapsFrame>
      <Carousel label="Free and swap items" className="free-swaps-carousel" header={<Header />}>
        {items.map((item) => (
          <li key={item.id}>
            <FreeSwapCard item={item} campusName={names.get(item.campusSlug) ?? ""} />
          </li>
        ))}
      </Carousel>
    </FreeAndSwapsFrame>
  );
}

function FreeAndSwapsFrame({ children }: { children: ReactNode }) {
  return (
    <section id="free-swaps" aria-labelledby="free-swaps-title" className="home-panel free-swaps">
      {children}
    </section>
  );
}

/** Navy, not sky-dark: sky-dark is 4.04:1 on the pale panel (plan decision 7). */
function Header() {
  return <SectionHeader id="free-swaps" eyebrow="Free & swaps" title="Pass it on" tone="navy" link={SEE_ALL} />;
}

function FreeSwapCard({ item, campusName }: { item: FreeSwapItem; campusName: string }) {
  return (
    <article className="free-card">
      <span className="free-card-media">
        <Photo
          image={{ src: item.image.src, alt: "" }}
          ratio="4 / 3"
          sizes="(orientation: landscape) and (max-height: 29.99rem) 23vw, (min-width: 64rem) and (min-height: 30rem) 204px, (min-width: 48rem) and (min-height: 30rem) 30vw, 46vw"
        />
        <span className={cx("free-stamp", item.kind === "swap" && "free-stamp-swap")}>
          {item.kind === "free" ? "Free" : "Swap"}
        </span>
      </span>
      <h3 className="free-card-title">
        {/* No prefetch: a row of cards would fetch every page as it scrolls past (mobile data). */}
        <Link href={`/listings/${item.id}`} prefetch={false} className="free-card-link">
          {item.title}
        </Link>
      </h3>
      <p className="free-card-meta">{campusName}</p>
    </article>
  );
}

/** The section's shape while it streams in (spec section 9). */
export function FreeAndSwapsSkeleton() {
  return (
    <FreeAndSwapsFrame>
      <Carousel label="Free and swap items" className="free-swaps-carousel" header={<Header />}>
        {Array.from({ length: 5 }, (_, n) => (
          <li key={n}>
            <div className="free-card" aria-hidden="true">
              <span className="skeleton free-skeleton-photo" />
              <span className="skeleton free-skeleton-line" />
              <span className="skeleton free-skeleton-meta" />
            </div>
          </li>
        ))}
      </Carousel>
    </FreeAndSwapsFrame>
  );
}

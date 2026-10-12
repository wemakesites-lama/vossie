import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses, getFeatured } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { sastToday } from "@/lib/time";
import type { Seller } from "@/lib/types";
import { Carousel } from "./Carousel";
import { Photo } from "./Photo";
import { SectionError } from "./SectionError";
import { SectionHeader } from "./SectionHeader";

const HOW_WE_PICK = { href: "/how-it-works", label: "How we pick", context: " featured sellers" };

/** Featured today (spec 7.10): the fair daily draw of verified sellers, the visitor's campus first. */
export function FeaturedToday() {
  return (
    <Suspense fallback={<FeaturedTodaySkeleton />}>
      <FeaturedTodayContent />
    </Suspense>
  );
}

export async function FeaturedTodayContent() {
  const { campus } = await getViewerContext();
  // The cookie read isn't enough for Next to allow a clock read (it still logs "unstable value new Date()" with
  // partial prefetching on). connection() defers the rest of this render to the request, as Next's docs ask.
  await connection();
  const day = sastToday();
  const data = await Promise.all([getFeatured({ campus, day }), getCampuses()]).catch(() => null);
  if (!data) {
    return (
      <FeaturedFrame>
        <SectionHeader id="featured" eyebrow="Featured today" title="Hustles on campus" link={HOW_WE_PICK} />
        <SectionError id="featured" title="Featured today" />
      </FeaturedFrame>
    );
  }

  const [sellers, campuses] = data;
  // Spec 7.10: with nobody to feature, the section hides.
  if (sellers.length === 0) return null;
  const names = new Map(campuses.map((item) => [item.slug, item.name]));
  const fromCampus = campus !== ALL_CAMPUSES && sellers.some((seller) => seller.campusSlug === campus);
  const title = fromCampus ? `Hustles at ${names.get(campus)}` : "Hustles on every campus";

  return (
    <FeaturedFrame>
      <Carousel
        label="Featured sellers"
        className="featured-carousel"
        header={<SectionHeader id="featured" eyebrow="Featured today" title={title} link={HOW_WE_PICK} />}
      >
        {sellers.map((seller) => (
          <li key={seller.slug}>
            <SellerCard seller={seller} campusName={names.get(seller.campusSlug) ?? ""} />
          </li>
        ))}
      </Carousel>
    </FeaturedFrame>
  );
}

function FeaturedFrame({ children }: { children: ReactNode }) {
  return (
    <section id="featured" aria-labelledby="featured-title" className="home-section">
      {children}
    </section>
  );
}

function SellerCard({ seller, campusName }: { seller: Seller; campusName: string }) {
  return (
    <article className="seller-card">
      <span className="seller-media">
        <Photo image={seller.image} ratio="4 / 3" sizes="(min-width: 64rem) and (min-height: 30rem) 270px, (min-width: 48rem) and (min-height: 30rem) 40vw, 64vw" />
        <span className="seller-tag">Featured</span>
      </span>
      <div className="seller-body">
        <h3 className="seller-name">
          <Link href={`/sellers/${seller.slug}`} className="seller-link">
            {seller.name}
          </Link>
        </h3>
        <p className="seller-tagline">{seller.tagline}</p>
        <p className="seller-meta">
          {seller.verified && (
            <span className="seller-seal">
              <CheckIcon className="size-2.5" strokeWidth={3} />
              <span className="sr-only">Verified seller.</span>
            </span>
          )}
          {seller.category} · {campusName}
        </p>
      </div>
    </article>
  );
}

/** The section's shape while it streams in (spec section 9). */
export function FeaturedTodaySkeleton() {
  return (
    <FeaturedFrame>
      <Carousel
        label="Featured sellers"
        className="featured-carousel"
        header={<SectionHeader id="featured" eyebrow="Featured today" title="Hustles on campus" link={HOW_WE_PICK} />}
      >
        {Array.from({ length: 4 }, (_, n) => (
          <li key={n}>
            <div className="seller-card" aria-hidden="true">
              <span className="skeleton seller-skeleton-photo" />
              <div className="seller-body">
                <span className="skeleton seller-skeleton-name" />
                <span className="skeleton seller-skeleton-line" />
                <span className="skeleton seller-skeleton-line" />
              </div>
            </div>
          </li>
        ))}
      </Carousel>
    </FeaturedFrame>
  );
}

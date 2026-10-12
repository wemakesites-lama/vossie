import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { getCategories } from "@/lib/data";
import { Carousel } from "./Carousel";
import { Photo } from "./Photo";
import { SectionHeader } from "./SectionHeader";

// Browse filters (a placeholder page in this stage). The query names will be settled with the browse page.
const BUDGETS = [
  { label: "Under R50", href: "/browse?max=50" },
  { label: "Under R100", href: "/browse?max=100" },
  { label: "Under R250", href: "/browse?max=250" },
  { label: "Free", href: "/browse?price=free" },
  { label: "Swaps", href: "/browse?pay=swap" },
];

/** Shop by category and budget (spec 7.5), the first carousel. */
export async function ShopByCategory() {
  const categories = await getCategories();
  return (
    <section aria-labelledby="categories-title" className="home-section">
      <Carousel
        label="Categories"
        className="category-carousel"
        header={
          <SectionHeader id="categories" eyebrow="Shop by category" link={{ href: "/browse", label: "All categories" }} />
        }
      >
        {categories.map((category) => (
          <li key={category.slug}>
            <Link href={`/categories/${category.slug}`} className="category-tile">
              <Photo
                image={{ src: category.image.src, alt: "" }}
                sizes="(orientation: landscape) and (max-height: 29.99rem) 21vw, (min-width: 64rem) and (min-height: 30rem) 172px, (min-width: 48rem) and (min-height: 30rem) 22vw, 42vw"
                className="category-photo"
              />
              <span className="category-name">{category.name}</span>
              <span className="category-cut" aria-hidden="true">
                <span>
                  <ArrowRightIcon className="size-3.5" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </Carousel>
      <div className="budget-row">
        <p id="budget-label" className="budget-label sr-only wide:not-sr-only">
          Shop by budget
        </p>
        <ul aria-labelledby="budget-label" className="budget-chips">
          {BUDGETS.map((budget) => (
            <li key={budget.href}>
              <Link href={budget.href} className="budget-chip">
                {budget.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

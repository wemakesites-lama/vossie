import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";
import { PageTransition } from "@/components/kit/PageTransition";
import { formatRand } from "@/lib/format";
import { PLUS_PRICE_ZAR, PLUS_YEAR_ZAR, STARTER_LISTINGS, STARTER_PHOTO_FILLS } from "@/lib/plans/plans";

export const metadata: Metadata = {
  title: "Plans for shops",
  description:
    "Buying on CampusCart is always free, and selling is free to start. Plus is a planned monthly plan for shops that grow. Nothing is charged during the pilot.",
};

/**
 * The plans (decision 100): words only. No form, no button and no payment: CampusCart takes none, and every shop has
 * everything while the pilot runs. The numbers come from `lib/plans/plans.ts`.
 */
const SECTIONS: readonly InfoSection[] = [
  {
    id: "plans-now",
    title: "Right now: free for every shop",
    children: (
      <>
        <p>
          CampusCart is in its pilot. Every approved shop has everything on this page, and nobody is asked to pay.
          CampusCart takes no payments of any kind today.
        </p>
        <p>Plus opens after the pilot. Every shop will be told well before it does.</p>
      </>
    ),
  },
  {
    id: "plans-buying",
    title: "Buying is always free",
    children: (
      <p>
        Browsing, searching, saving, messaging a seller and posting a Looking For request cost nothing, and they never
        will. A marketplace needs its buyers, so there&apos;s no fee at the door.
      </p>
    ),
  },
  {
    id: "plans-starter",
    title: "Starter: free",
    children: (
      <>
        <p>For every shop, for as long as it likes.</p>
        <ul>
          <li>A shop the Incubation Hub has checked, with its own page and link.</li>
          <li>Up to {STARTER_LISTINGS} listings live at once.</li>
          <li>Messages, swap offers and offers on Looking For requests.</li>
          <li>The trust badges: New seller, Responsive and Trusted.</li>
          <li>&ldquo;Fill in from my photo&rdquo; {STARTER_PHOTO_FILLS} times a month.</li>
          <li>
            <Link href="/hub">Launchpad</Link>: events, office hours and selling tips.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "plans-plus",
    title: `Plus: ${formatRand(PLUS_PRICE_ZAR)} a month`,
    children: (
      <>
        <p>For shops that are growing. Plus will add:</p>
        <ul>
          <li>As many live listings as you like.</li>
          <li>&ldquo;Fill in from my photo&rdquo; whenever you list, up to 20 times a day.</li>
          <li>Shop coach: up to three actions for your week, every Monday.</li>
          <li>Your shop&apos;s numbers over time, not only the last 7 days.</li>
        </ul>
        <p>
          A year of Plus is {formatRand(PLUS_YEAR_ZAR)}, about what one second-hand textbook sells for.
        </p>
      </>
    ),
  },
  {
    id: "plans-never",
    title: "What's never for sale",
    children: (
      <>
        <p>Some things can&apos;t be bought on either plan:</p>
        <ul>
          <li>The Hub&apos;s check on a new shop.</li>
          <li>
            Verified. <Link href="/trust#trust-verified">Only the Hub gives it.</Link>
          </li>
          <li>
            The three badges. <Link href="/trust#trust-badges">Shops earn them</Link> from replies and confirmed sales.
          </li>
          <li>
            A place in Featured today, which is <Link href="/trust#trust-featured">drawn fairly</Link>.
          </li>
          <li>Your data. CampusCart doesn&apos;t sell it.</li>
        </ul>
      </>
    ),
  },
  {
    id: "plans-paying",
    title: "How paying will work",
    children: (
      <>
        <p>
          Plus will be paid monthly, by card, in rand. You&apos;ll be able to cancel at any time and go back to
          Starter.
        </p>
        <p>
          CampusCart takes no cut of what you sell on either plan. Buyers still pay you when you meet, as the{" "}
          <Link href="/seller-guidelines">seller guidelines</Link> say.
        </p>
        <p>
          Ready to start? <Link href="/sell">Set up your shop</Link>.
        </p>
      </>
    ),
  },
];

export default function PlansPage() {
  return (
    <PageTransition>
      <InfoPage
        route="/plans"
        title="Plans for shops"
        lede="Buying is free. Selling is free to start. Plus is for shops that grow."
        updated="2026-11-05"
        sections={SECTIONS}
      />
    </PageTransition>
  );
}

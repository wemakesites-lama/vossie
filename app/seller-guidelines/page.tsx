import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";
import { PageTransition } from "@/components/kit/PageTransition";

export const metadata: Metadata = {
  title: "Seller guidelines",
  description:
    "How to sell well on CampusCart, and what can't be sold: honest listings, fair prices, quick replies and safe handovers. A draft for Eduvos to review.",
  // A draft stays out of search results until Eduvos signs it off (controller amendment 1, spec decision 8).
  robots: { index: false },
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "guidelines-who",
    title: "Who can sell",
    children: (
      <p>
        Eduvos students can sell on CampusCart once the Incubation Hub has checked their shop. You can sell as yourself or as
        your small business. What you list must be yours to sell.
      </p>
    ),
  },
  {
    id: "guidelines-banned",
    title: "What can't be sold",
    children: (
      <>
        <p>These can never be sold on CampusCart, whatever the price:</p>
        <ul>
          <li>weapons, and anything made to hurt people;</li>
          <li>alcohol or tobacco sold to anyone under 18;</li>
          <li>medicines;</li>
          <li>counterfeit goods, such as fake brands, copied software or pirated books and music;</li>
          <li>
            academic dishonesty, such as writing someone&apos;s assignment or sitting a test for them. Tutoring and study
            notes are welcome. Passing off someone else&apos;s work is not;
          </li>
          <li>stolen goods, and anything you do not have the right to sell; and</li>
          <li>anything else that is against the law.</li>
        </ul>
        <p>Not sure? Ask the Hub before you list it.</p>
      </>
    ),
  },
  {
    id: "guidelines-honest",
    title: "Honest listings and photos",
    children: (
      <ul>
        <li>Use your own photos of the real item, not pictures from the internet.</li>
        <li>Give it a title that says what it is, and describe its condition honestly, faults included.</li>
        <li>Keep people, ID documents and anything private out of your photos.</li>
        <li>Mark a listing Sold or Paused as soon as it is no longer available.</li>
      </ul>
    ),
  },
  {
    id: "guidelines-prices",
    title: "Prices and swaps",
    children: (
      <ul>
        <li>Prices are in rand. The price you list is the price you ask, with no extras added at pickup.</li>
        <li>Free is fine. If you are giving something away, say so.</li>
        <li>
          For a swap, say what you would take in return and be fair. A swap works like a sale: both people see what they
          are getting before anything changes hands.
        </li>
      </ul>
    ),
  },
  {
    id: "guidelines-reply",
    title: "Replying within 48 hours",
    children: (
      <p>
        Buyers are waiting. Reply to every enquiry within 48 hours, even if the answer is no. Quick replies are what earn
        the Responsive and Trusted badges. <Link href="/trust">How trust works</Link> has the rules.
      </p>
    ),
  },
  {
    id: "guidelines-meeting",
    title: "Meeting buyers",
    children: (
      <ul>
        <li>
          Hand over at an approved pickup point on campus, in daylight, as the <Link href="/safety">safety guide</Link>{" "}
          describes.
        </li>
        <li>Never ask a buyer for money before you meet, or for their bank details or codes.</li>
        <li>
          When the handover is done, mark the sale completed so the buyer can confirm it. Confirmed sales count towards
          your badges.
        </li>
      </ul>
    ),
  },
  {
    id: "guidelines-reports",
    title: "After a report",
    children: (
      <>
        <p>
          Anyone can report a listing or a seller. A member of the Hub team reads every report. We may hide the listing
          while we look, ask you to change it, or, in serious cases, pause your account. Where we can, we will tell you
          what happened and why.
        </p>
        <p>
          If you think we got it wrong, contact the Hub and we will look again. Repeated or serious breaches can mean
          your account is closed.
        </p>
      </>
    ),
  },
];

export default function SellerGuidelinesPage() {
  return (
    <PageTransition>
      <InfoPage
        title="Seller guidelines"
        lede="How to sell well on CampusCart, and what is not allowed."
        updated="2026-10-14"
        draft
        sections={SECTIONS}
      />
    </PageTransition>
  );
}

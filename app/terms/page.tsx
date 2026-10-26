import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";
import { PageTransition } from "@/components/kit/PageTransition";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "The rules for using CampusCart, the Eduvos student marketplace, in plain words: who can use it, what you can't do, and what CampusCart is and isn't responsible for. A draft for Eduvos to review.",
  // A draft stays out of search results until Eduvos signs it off (controller amendment 1, spec decision 8).
  robots: { index: false },
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "terms-who",
    title: "Who can use CampusCart",
    children: (
      <ul>
        <li>
          Anyone can browse CampusCart. To message a seller, sell or report something, you need an account, and accounts are
          for Eduvos students.
        </li>
        <li>If you are under 18, you need the consent of a parent or guardian to use CampusCart.</li>
        <li>Keep your sign-in to yourself. You are responsible for what happens under your account.</li>
      </ul>
    ),
  },
  {
    id: "terms-deal",
    title: "CampusCart is not part of your deal",
    children: (
      <>
        <p>
          CampusCart is a noticeboard that helps students find each other. When you buy, sell or swap, the deal is between
          you and the other person. CampusCart is not the buyer or the seller, does not hold anyone&apos;s money or goods,
          and does not check every listing. It cannot promise that an item is as described or that someone will turn up.
        </p>
        <p>
          Check what you are buying, meet safely and read the <Link href="/safety">safety guide</Link>. The Verified tick
          and the badges show how a seller has behaved on CampusCart. They are not a guarantee.
        </p>
      </>
    ),
  },
  {
    id: "terms-prohibited",
    title: "What you can't do",
    children: (
      <>
        <p>You may not use CampusCart to:</p>
        <ul>
          <li>
            sell anything the <Link href="/seller-guidelines">seller guidelines</Link> say cannot be sold;
          </li>
          <li>post anything false, misleading, offensive or against the law;</li>
          <li>harass, threaten or discriminate against anyone;</li>
          <li>send spam, or advertise things that are not for sale on CampusCart;</li>
          <li>collect other people&apos;s personal information;</li>
          <li>pretend to be someone else; or</li>
          <li>break, overload or get around the site.</li>
        </ul>
      </>
    ),
  },
  {
    id: "terms-content",
    title: "What you post",
    children: (
      <>
        <p>
          What you post is yours: your photos, descriptions and messages. By posting it on CampusCart you let Eduvos show it
          on CampusCart and in link previews, and store and copy it as the site needs, for as long as it is on CampusCart.
        </p>
        <ul>
          <li>Only post what you have the right to share.</li>
          <li>Do not post photos of other people without their consent.</li>
          <li>Keep phone numbers, addresses, ID numbers and other personal information out of listings and messages.</li>
        </ul>
      </>
    ),
  },
  {
    id: "terms-moderation",
    title: "Moderation and suspension",
    children: (
      <p>
        The Incubation Hub team can hide a listing, remove content, or pause or close an account that breaks these terms,
        the seller guidelines or the law, or that puts people at risk. Where we can, we will tell you why. If you think we
        got it wrong, contact the Hub and we will look again.
      </p>
    ),
  },
  {
    id: "terms-liability",
    title: "Our responsibility",
    children: (
      <>
        <p>
          We work to keep CampusCart running and accurate, but it is provided as it is. We cannot promise that it will always
          be available or free of mistakes.
        </p>
        <p>
          As far as the law allows, Eduvos is not responsible for losses from deals between users, for items that are not
          as described, or for what other users say or do. Nothing here limits a right you have by law that cannot be
          limited.
        </p>
      </>
    ),
  },
  {
    id: "terms-changes",
    title: "Changes and the law",
    children: (
      <>
        <p>
          We may change these terms. The new version will go on this page with a new date, and signed-in users will be
          told about changes that matter. If you keep using CampusCart after a change, you accept it.
        </p>
        <p>These terms follow South African law.</p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <PageTransition>
      <InfoPage
        title="Terms of use"
        lede="The rules for using CampusCart, in plain words."
        updated="2026-10-14"
        draft
        sections={SECTIONS}
      />
    </PageTransition>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "How trust works",
  description:
    "How Vossie decides who to trust: Verified sellers, the New seller, Responsive and Trusted badges, and how Featured today is picked.",
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "trust-verified",
    title: "Verified by the Hub",
    children: (
      <>
        <p>
          <strong>Verified</strong> means the Eduvos Incubation Hub has looked at a seller and approved their shop. The
          Hub does this by hand, before a new seller can list anything. A Verified seller has a tick and the word
          Verified on their listings and their shop.
        </p>
        <p>
          Verified tells you the Hub knows who the seller is. It isn&apos;t a promise that a deal will go well, so keep
          to the <Link href="/safety">safety steps</Link> every time.
        </p>
      </>
    ),
  },
  {
    id: "trust-badges",
    title: "The three badges",
    children: (
      <>
        <p>
          Badges are worked out by Vossie from what a seller does, not from what they say. A seller shows the highest
          badge they meet, and a badge can go down again if their habits change.
        </p>
        <p>
          Vossie is still being built, so the badges you see on sellers today are samples. The rules below are how real
          badges will be worked out once accounts are live.
        </p>
        <h3>New seller</h3>
        <p>
          Everyone starts here. It means the seller hasn&apos;t built up a record on Vossie yet, which is normal for a
          new shop.
        </p>
        <h3>Responsive</h3>
        <p>
          In the last 90 days the seller has had at least 3 enquiries and replied to at least 80% of them within 48
          hours.
        </p>
        <h3>Trusted</h3>
        <p>
          In the last 90 days the seller has had at least 3 enquiries and replied to at least 85% of them within 48
          hours. They also have at least 5 sales or swaps that buyers have confirmed, and their account is at least 30
          days old.
        </p>
      </>
    ),
  },
  {
    id: "trust-counts",
    title: "What counts",
    children: (
      <>
        <ul>
          <li>An enquiry is a buyer&apos;s first message to a seller about a listing, sent through Vossie.</li>
          <li>
            The 48 hours run from when the message arrives. A message that is still inside its 48 hours doesn&apos;t
            count against the seller.
          </li>
          <li>
            A sale or swap counts once the buyer confirms it, or a week after the seller marks it completed if the buyer
            says nothing. If the buyer says it didn&apos;t happen, it doesn&apos;t count.
          </li>
          <li>
            Chats that happen outside Vossie, such as on WhatsApp, can&apos;t be seen, so they don&apos;t count either
            way.
          </li>
        </ul>
        <p>A badge is a record of how someone has behaved on Vossie so far. It isn&apos;t a guarantee.</p>
      </>
    ),
  },
  {
    id: "trust-featured",
    title: "How Featured today is picked",
    children: (
      <>
        <p>
          The Featured today row on the homepage shows sellers the Hub has verified. Once accounts are live, each campus
          gets its own draw every day, for up to four places:
        </p>
        <ul>
          <li>Only Verified sellers with an open shop and something listed can be picked.</li>
          <li>It&apos;s a fair draw. There are no paid places.</li>
          <li>
            If you&apos;ve chosen a campus, its sellers come first, and sellers from other campuses fill any gaps.
          </li>
          <li>A seller who has been featured sits out for a week before they can be picked again.</li>
          <li>
            Hub staff can pin a Verified seller to a campus for a day. A pinned seller takes one of the places before the
            draw.
          </li>
        </ul>
      </>
    ),
  },
];

export default function TrustPage() {
  return (
    <InfoPage
      title="How trust works"
      lede="No star ratings. Trust here comes from checks by the Hub and from what sellers actually do."
      updated="2026-10-14"
      sections={SECTIONS}
    />
  );
}

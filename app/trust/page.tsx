import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";
import { PageTransition } from "@/components/kit/PageTransition";

export const metadata: Metadata = {
  title: "How trust works",
  description:
    "How CampusCart decides who to trust: Verified sellers, the New seller, Responsive and Trusted badges, what happens after a report, and how Featured today is picked.",
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "trust-verified",
    title: "Verified by the Hub",
    children: (
      <>
        <p>
          <strong>Verified</strong> is a badge the Eduvos Incubation Hub gives a seller after checking who they are and
          how they trade. It&apos;s separate from approval: the Hub approves every shop before it can sell, and only
          some approved shops are Verified. A Verified seller has a tick and the word Verified on their listings and
          their shop.
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
          Badges are worked out by CampusCart from what a seller does, not from what they say. A seller shows the highest
          badge they meet, and a badge can go down again if their habits change.
        </p>
        <p>
          A shop with an account behind it gets its badge worked out by the rules below, from its conversations on
          CampusCart, whenever the Hub reviews the marketplace and after each reply or confirmed sale. While CampusCart is a
          preview, most shops are samples with no account behind them, and they show sample badges.
        </p>
        <h3>New seller</h3>
        <p>
          Everyone starts here. It means the seller hasn&apos;t built up a record on CampusCart yet, which is normal for a
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
          <li>An enquiry is a buyer&apos;s first message to a seller about a listing, sent through CampusCart.</li>
          <li>
            The 48 hours run from when the message arrives. A message that is still inside its 48 hours doesn&apos;t
            count against the seller.
          </li>
          <li>
            A sale or swap counts once the buyer confirms it, or a week after the seller marks it completed if the buyer
            says nothing. If the buyer says it didn&apos;t happen, it doesn&apos;t count.
          </li>
          <li>
            Chats that happen outside CampusCart, such as on WhatsApp, can&apos;t be seen, so they don&apos;t count either
            way.
          </li>
        </ul>
        <p>A badge is a record of how someone has behaved on CampusCart so far. It isn&apos;t a guarantee.</p>
      </>
    ),
  },
  // Sample wording for later review: Lama kept the spec's sentences "for now" on 2026-10-20 (stage K plan decision 5).
  {
    id: "trust-reports",
    title: "When something is reported",
    children: (
      <>
        <p>
          Anyone signed in can report a listing, a shop or a Looking For request. A member of the Hub team reads every
          report.
        </p>
        <p>
          The Hub can hide a listing or a request, or pause a shop. It tells the seller, or the student who asked, and
          they can see why. It tells the person who reported it that the Hub has acted, and never names them to the
          seller.
        </p>
        <p>
          If the Hub hid something it shouldn&apos;t have, it can show it again, and tells the seller or the student
          who asked. Hub staff are mentors and admins from the Eduvos Incubation Hub, and only a Hub admin can give
          someone that role.
        </p>
      </>
    ),
  },
  {
    id: "trust-featured",
    title: "How Featured today is picked",
    children: (
      <>
        <p>
          The Featured today row on the homepage shows sellers the Hub has verified. Each campus gets its own draw every
          day, for up to four places:
        </p>
        <ul>
          <li>Only Verified sellers with an open shop and something listed can be picked.</li>
          <li>It&apos;s a fair draw. There are no paid places.</li>
          <li>
            If you&apos;ve chosen a campus, its sellers come first, and sellers from other campuses fill any gaps.
          </li>
          <li>
            A seller who has been featured sits out for a week when there are enough other Verified sellers to fill the
            row. When there aren&apos;t, the sellers featured longest ago come back first.
          </li>
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
    <PageTransition>
      <InfoPage
        route="/trust"
        title="How trust works"
        lede="No star ratings. Trust here comes from checks by the Hub and from what sellers actually do."
        updated="2026-10-21"
        sections={SECTIONS}
      />
    </PageTransition>
  );
}

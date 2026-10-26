import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";
import { PageTransition } from "@/components/kit/PageTransition";

export const metadata: Metadata = {
  title: "How CampusCart works",
  description:
    "How buying and selling work on CampusCart, the Eduvos student marketplace: find it, message the seller, meet on campus, then pay or swap.",
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "how-buying",
    title: "Buying",
    children: (
      <>
        <p>
          CampusCart is where Eduvos students buy and sell textbooks, tech, food, services and more. There&apos;s no cart and
          no checkout. You and the seller agree the details, then meet.
        </p>
        <ol>
          <li>
            <strong>Find it.</strong> Search, or browse by category. Your campus comes first, and you can shop every
            campus.
          </li>
          <li>
            <strong>Message the seller.</strong> Ask what you need to know. If they take swaps, you can offer one.
          </li>
          <li>
            <strong>Meet at a pickup point.</strong> Pickup points are approved spots on campus, like the library
            entrance or the main reception. Agree a time that suits you both.
          </li>
          <li>
            <strong>See it, then pay or swap.</strong> Check the item first. If it&apos;s what you were promised, pay
            cash or swap on the spot. CampusCart takes no online payments.
          </li>
        </ol>
        <p>
          Never pay before you&apos;ve seen it. The <Link href="/safety">safety guide</Link> has the rest.
        </p>
      </>
    ),
  },
  {
    id: "how-selling",
    title: "Selling",
    children: (
      <>
        <p>Listing is free. Here&apos;s how a shop gets going:</p>
        <ol>
          <li>
            <strong>Apply.</strong> Sign in with your Eduvos email and set up your shop. It takes about three minutes,
            from your phone.
          </li>
          <li>
            <strong>Get checked by the Hub.</strong> The Eduvos Incubation Hub looks at every new seller before they can
            list.
          </li>
          <li>
            <strong>List what you have.</strong> Add clear photos, an honest description and a fair price in rand. Say
            if you&apos;ll take a swap.
          </li>
          <li>
            <strong>Reply within 48 hours.</strong> Buyers don&apos;t like waiting, and quick replies help you earn
            badges.
          </li>
        </ol>
        <p>
          The rules for sellers are in the <Link href="/seller-guidelines">seller guidelines</Link>.
        </p>
      </>
    ),
  },
  {
    id: "how-trust",
    title: "Trust, in one paragraph",
    children: (
      <p>
        CampusCart has no star ratings. The Incubation Hub marks the sellers it has checked as Verified, and CampusCart awards
        badges for what a seller actually does: replying quickly and completing sales that buyers confirm.{" "}
        <Link href="/trust">How trust works</Link> explains each one.
      </p>
    ),
  },
  {
    id: "how-questions",
    title: "Questions and answers",
    children: (
      <>
        <h3>Who can use CampusCart?</h3>
        <p>
          Anyone can browse, save and share listings, and read Looking For and the Hub. Messaging, selling, reporting,
          posting a request, following a shop, saving a search and saying you&apos;ll go to a Hub event need an
          account. Accounts are for Eduvos students, who sign in with their Eduvos email address.
        </p>
        <h3>Does it cost anything?</h3>
        <p>Listing is free. CampusCart doesn&apos;t handle payments, so it takes no cut of a sale.</p>
        <h3>How do I pay?</h3>
        <p>
          Straight to the seller, in cash or as a swap, when you meet. Agree it when you message. Don&apos;t pay before
          you&apos;ve seen the item or had the service.
        </p>
        <h3>Can I buy from another campus?</h3>
        <p>
          You can browse every campus. Things you collect in person are collected at the campus where they&apos;re
          listed, and each listing says where. Delivery between campuses isn&apos;t available yet.
        </p>
        <h3>How do I become a seller?</h3>
        <p>
          Sign in, press Start selling on Sell, and answer five short questions about your shop. The Incubation Hub
          checks it, usually within two working days, and you can prepare listings while it does.
        </p>
        <h3>What can I do on CampusCart today?</h3>
        <p>
          Browse every campus, save listings on your device and share them, and sign in with your Eduvos email. Signed
          in, you can message sellers, report a problem, ask for something on Looking For and read shops&apos; offers,
          follow shops, save a search and hear when a new listing matches it, say you&apos;ll go to a Hub event or ask
          for an office-hours slot, and set up a shop of your own.
        </p>
        <p>
          Requests close automatically 3 days after their needed-by date, or after 30 days with no changes. You&apos;re
          reminded 2 days before, and you can reopen one.
        </p>
        <p>
          While CampusCart is a preview, what you add lives in the server&apos;s memory, so it can disappear when the
          server restarts. Notifications show on CampusCart only: nothing is emailed yet.
        </p>
      </>
    ),
  },
];

export default function HowItWorksPage() {
  return (
    <PageTransition>
      <InfoPage
        route="/how-it-works"
        title="How CampusCart works"
        lede="Find it, message the seller, meet on campus, then pay or swap."
        updated="2026-10-21"
        sections={SECTIONS}
      />
    </PageTransition>
  );
}

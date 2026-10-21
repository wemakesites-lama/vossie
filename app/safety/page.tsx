import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "Safety",
  description:
    "How to buy and sell safely on CampusCart: meeting on campus, checking an item, never paying in advance, spotting a scam and reporting a problem.",
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "safety-meeting",
    title: "Meeting safely",
    children: (
      <ul>
        <li>Meet at an approved pickup point on campus. A listing you collect in person shows where.</li>
        <li>Go in daylight, while there are other people around.</li>
        <li>Take a friend, or tell someone where you&apos;re going and when you expect to be back.</li>
        <li>
          Stick to the plan. If the other person suggests somewhere else, say no and offer a pickup point instead.
        </li>
        <li>
          For tutoring and other services, meet in a busy part of campus, or online, and keep to the time you agreed.
        </li>
      </ul>
    ),
  },
  {
    id: "safety-checking",
    title: "Checking before you pay",
    children: (
      <ul>
        <li>Look at the item properly. Switch it on, open it, try it.</li>
        <li>
          With a phone, laptop or calculator, check that it works and that it isn&apos;t locked to someone else&apos;s
          account.
        </li>
        <li>With a textbook, check the edition and that every page is there.</li>
        <li>
          Make sure it matches the listing: the photos, the description and the price. If it doesn&apos;t, you can walk
          away.
        </li>
        <li>Take your time. A good seller won&apos;t rush you.</li>
      </ul>
    ),
  },
  {
    id: "safety-paying",
    title: "Paying safely",
    children: (
      <ul>
        <li>
          Pay only when you have the item in your hands, or you&apos;ve had the service. Never pay a deposit or pay in
          advance, even a small amount.
        </li>
        <li>
          CampusCart has no online payments, so nobody on CampusCart should ask you to pay by EFT, voucher or app before you
          meet.
        </li>
        <li>
          Never share your bank card details, PIN, passwords or one-time codes (OTPs), not with a seller, a buyer or
          anyone who says they&apos;re from CampusCart.
        </li>
        <li>
          If you&apos;re paid in cash, check it before you hand over the item. If it&apos;s a swap, see what you&apos;re
          getting before you hand over what you&apos;re giving.
        </li>
      </ul>
    ),
  },
  {
    id: "safety-scams",
    title: "Signs of a scam",
    children: (
      <>
        <p>Be careful if someone:</p>
        <ul>
          <li>asks you to pay first, or to pay a &quot;deposit&quot; or &quot;booking fee&quot; to hold something;</li>
          <li>sends a screenshot as proof that they&apos;ve paid. Check your own bank balance instead;</li>
          <li>is in a hurry, or says someone else is about to buy it;</li>
          <li>offers a price that&apos;s too good to be true;</li>
          <li>asks for your ID number, bank details or a code sent to your phone;</li>
          <li>wants to move the chat somewhere else, or won&apos;t meet on campus or show you the item first.</li>
        </ul>
        <p>If something feels wrong, stop. You don&apos;t owe anyone an explanation.</p>
      </>
    ),
  },
  {
    id: "safety-reporting",
    title: "Reporting a problem",
    children: (
      <>
        <p>
          If a listing, a request or a person worries you, report it. Every listing, every seller&apos;s page and every
          Looking For request has a Report link. Reporting needs an account: signed out, the link takes you to sign in
          first, then to the report. A member of the Hub team reads every report, and can hide a listing or a request,
          or pause an account.
        </p>
        <p>
          If you&apos;re in danger, get somewhere safe and tell campus security. If a crime has happened, call the police
          on 10111.
        </p>
        <p>
          Want to know how CampusCart checks its sellers? Read <Link href="/trust">how trust works</Link>, or find out about
          the <Link href="/hub">Incubation Hub</Link> that runs CampusCart.
        </p>
      </>
    ),
  },
];

export default function SafetyPage() {
  return (
    <InfoPage
      title="Safety"
      lede="Meet in a safe place, check before you pay, and trust your gut."
      updated="2026-10-20"
      sections={SECTIONS}
    />
  );
}

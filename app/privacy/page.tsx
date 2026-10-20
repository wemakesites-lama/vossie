import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Vossie handles your personal information under POPIA: what this site stores today, what your account holds, who sees it and your rights. A draft for Eduvos to review.",
  // A draft stays out of search results until Eduvos signs it off (controller amendment 1, spec decision 8).
  robots: { index: false },
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "privacy-who",
    title: "Who is responsible",
    children: (
      <>
        <p>
          Vossie is an Eduvos Incubation Hub project. Under the Protection of Personal Information Act 4 of 2013 (POPIA),
          Eduvos is the responsible party for the personal information collected through Vossie.
        </p>
        <ul>
          <li>
            <strong>Information Officer:</strong> to be named by Eduvos.
          </li>
          <li>
            <strong>Contact:</strong> the Incubation Hub team. See <a href="#privacy-contact">Contact the Hub</a> below.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "privacy-today",
    title: "What this site stores today",
    children: (
      <>
        <p>
          Vossie is still a preview. If you sign in, the server keeps your account, your sign-ins, your consent, your
          Looking For requests and the shops you follow, your saved searches, your RSVPs and slot requests, your messages, your
          reports, your notifications and, if you sell, your shop, your
          listings and their photos in its memory only, so they are wiped whenever it restarts, and no email is sent (the sign-in code shows on the
          screen). Apart from that, a few small things are kept on your own device, so the site can remember your
          choices.
        </p>
        <h3>Two first-party cookies</h3>
        <p>
          A cookie is a small file your browser keeps and sends back to Vossie with each page it asks for. These two
          belong to Vossie and nobody else. Some browsers, such as Safari on an iPhone, clear cookies like these after a
          week.
        </p>
        <ul>
          <li>
            <code>vossie_campus</code>: the campus you chose, so pages can show it first. It lasts up to a year.
          </li>
          <li>
            Your saved listings, in a cookie called <code>vossie_saved</code> that lasts up to a year. Your browser sends
            the listing ids to Vossie with each visit so the Saved page can show them; nothing is stored on a server.
          </li>
        </ul>
        <h3>Three sign-in cookies</h3>
        <p>
          These belong to Vossie too. The first two can only be read by Vossie&apos;s server, never by scripts on the
          page.
        </p>
        <ul>
          <li>
            <code>vossie_session</code>: a random code that keeps you signed in, for up to 30 days. Signing out or
            deleting your account ends it.
          </li>
          <li>
            <code>vossie_signin</code>: a random code that holds your place while you sign in, for up to 30 minutes.
          </li>
          <li>
            <code>vossie_flash</code>: a one-off message such as &quot;You&apos;re signed out&quot;, for up to a minute.
          </li>
        </ul>
        <h3>Four things kept only in your browser</h3>
        <p>These stay in your browser&apos;s own storage. They are never sent to Vossie.</p>
        <ul>
          <li>
            <code>vossie_recently_viewed</code>: the last few listings you opened, for &quot;Pick up where you left
            off&quot; on the homepage.
          </li>
          <li>
            <code>vossie_recent_searches</code>: your last few searches, offered as suggestions in the search box.
          </li>
          <li>
            <code>vossie_low_data</code>: whether you turned data saver on.
          </li>
          <li>
            <code>vossie_offline</code>: a copy of Vossie&apos;s offline page, kept by Vossie&apos;s service worker so
            an installed Vossie can say you&apos;re offline instead of showing an error. It holds nothing about you and
            no page you looked at.
          </li>
        </ul>
        <h3>What else happens</h3>
        <ul>
          <li>
            When you search, the words you type are sent to Vossie in the page address (for example{" "}
            <code>/browse?q=calculator</code>), so it can find results.
          </li>
          <li>
            Whoever hosts Vossie keeps ordinary server logs (page addresses, times and technical details of each
            request) to keep the site running and secure. The hosting service is still to be decided.
          </li>
          <li>
            The campus updates form in the footer doesn&apos;t send or store your email address yet. When there is a real
            mailing list, it will ask for your consent first, and this policy will say so.
          </li>
          <li>
            Your browser keeps the listing photos it loads, so it doesn&apos;t use your data to fetch them again. If a
            photo is deleted, a copy can stay on a device that already loaded it until that browser clears its cached
            images and files.
          </li>
          <li>Vossie uses no advertising or tracking cookies, and no analytics.</li>
        </ul>
        <p>
          Clearing your browser&apos;s cookies, site data, and cached images and files removes everything listed here.
        </p>
      </>
    ),
  },
  {
    id: "privacy-sign-in",
    title: "Your account",
    children: (
      <>
        <p>
          Messaging, selling and, later, keeping your saves on every device need an account. This is what your account
          holds, and why.
        </p>
        <ul>
          <li>
            <strong>Your Eduvos email address.</strong> To check that you are an Eduvos student and to send you sign-in
            codes. Allowed under POPIA section 11: it is needed to run the account you ask for.
          </li>
          <li>
            <strong>Your first name and campus.</strong> Sellers see your first name in messages, so they know who they
            are talking to. Your campus puts your campus first. Allowed under POPIA section 11: needed to run your
            account.
          </li>
          <li>
            <strong>Your agreement to this policy.</strong> We keep the version you agreed to and the time, as a record
            that you were asked. Allowed under POPIA section 11: your consent.
          </li>
          <li>
            <strong>A sign-in cookie.</strong> A random code that keeps you signed in for up to 30 days. Allowed under
            POPIA section 11: needed to run your account.
          </li>
          <li>
            <strong>Your messages, swap offers and reports.</strong> To pass them to the other person, to work out reply
            times for trust badges, and to keep Vossie safe. Allowed under POPIA section 11: needed to run the service,
            and our legitimate interest in keeping students safe.
          </li>
          <li>
            <strong>Your RSVPs and slot requests.</strong> When you say you&apos;re going to a Hub event or ask for a
            slot at office hours, we keep that, what you&apos;d like help with and the time that suits, so the Hub can
            plan and a mentor can answer. Hub staff see your first name with a request. Allowed under POPIA section 11:
            needed to give you what you asked for.
          </li>
          <li>
            <strong>Your notifications.</strong> A note when someone messages you or a sale needs confirming, which
            only you see. Allowed under POPIA section 11: needed to run your account.
          </li>
          <li>
            <strong>Your Looking For requests.</strong> What you ask for, shown to everyone as &quot;Asked by a student
            at&quot; your campus, never with your name. Vossie keeps which account asked, so only you can change or
            delete it. Allowed under POPIA section 11: needed to run the service you ask for.
          </li>
          <li>
            <strong>The shops you follow.</strong> So Saved can list them and tell you when they list something new; a
            shop sees only how many people follow it, never who. Allowed under POPIA section 11: needed to run the
            service you ask for.
          </li>
          <li>
            <strong>Your saved searches.</strong> The words and filters of each search you save, when you saved it and
            whether its alerts are paused, kept with your account. Only you see them: shops never learn who was told,
            and Hub staff tools don&apos;t show them. They are used only to tell you about new listings that match.
            Allowed under POPIA section 11: needed to run the service you ask for.
          </li>
          <li>
            <strong>If you sell: your shop, your listings and their photos.</strong> Shop name, tagline, about text,
            photo, campus, pickup points and what you list, shown to buyers, and your application while the Hub checks
            it. Your answers while you set up your shop are kept as a draft until you send your application. Your
            browser makes photos smaller when it can, and hidden data such as your location is removed from every photo
            before Vossie keeps it: only what a photo needs to show properly, such as its colours and which way up it
            is, stays. Allowed under POPIA section 11: needed to run your shop.
          </li>
          <li>
            <strong>If the Hub mentors your shop: mentors&apos; notes.</strong> A mentor the Hub assigns to your shop
            can keep private notes and check-ins about it. Mentors and Hub admins can see them; you can&apos;t, and
            they aren&apos;t in your data download, but you can ask the Information Officer for them. They are deleted
            with your account. Allowed under POPIA section 11: our legitimate interest in supporting student
            businesses.
          </li>
          <li>
            <strong>A log of what Hub staff do.</strong> Who approved, declined, verified, hid or paused what, when and
            why, and who was given or lost a staff role, so staff actions can be checked. Nobody can edit it. If you delete your account, entries about you
            lose your name and the reason. Allowed under POPIA section 11: our legitimate interest in running Vossie
            fairly.
          </li>
        </ul>
        <p>Vossie does not ask for your ID number, your bank details or your home address.</p>
      </>
    ),
  },
  {
    id: "privacy-keep",
    title: "How long we keep it",
    children: (
      <ul>
        <li>
          The campus and saved cookies last up to a year, and some browsers clear them sooner. The sign-in cookies last
          up to 30 days, 30 minutes and a minute. Your browser keeps the other four things until you clear them.
        </li>
        <li>Your account details stay until you delete your account.</li>
        <li>
          Deleting your account removes your account, your sign-in sessions, your record of consent, your Looking For
          requests, the shops you follow, your saved searches, your RSVPs and slot requests, your messages, your reports
          and your notifications straight away, along with your shop, your
          listings, every photo you uploaded, any shop answers you had not sent and mentors&apos; notes about your shop,
          if you sell. The other person in a conversation keeps only their own messages, and your name shows as
          &quot;Deleted account&quot;. The log of what Hub staff do keeps its entries, without your name.
        </li>
        <li>
          While Vossie is a preview, Looking For requests, follows, saved searches, messages, reports, notifications, shops, listings
          and photos live in the server&apos;s memory and go whenever it restarts. Eduvos will set how long they are kept before launch, and
          this policy will say so.
        </li>
        <li>
          Server logs are kept for a short time. The hosting service decides how long, and this policy will say once it
          is chosen.
        </li>
      </ul>
    ),
  },
  {
    id: "privacy-sharing",
    title: "Who it is shared with",
    children: (
      <>
        <p>Vossie does not sell personal information to anyone, and does not share it for advertising.</p>
        <ul>
          <li>
            <strong>Other students</strong> see only what they need. A seller&apos;s shop name, photos and listings are
            public. A buyer&apos;s first name is shown to the seller they message. Requests on the Looking For board say
            &quot;a student&quot;, never a name.
          </li>
          <li>
            <strong>Hub staff</strong> can see reports, account details, RSVPs and slot requests when they need to, to
            approve sellers, run the Hub&apos;s events and keep Vossie safe. A mentor sees your shop&apos;s numbers,
            never your messages.{" "}
            Hub admins see weekly counts for each campus (listings, shops, requests, enquiries, reports and follows),
            never who; small numbers are hidden so no one can be picked out.
          </li>
          <li>
            <strong>Service providers</strong> that run Vossie for Eduvos, such as hosting, the database and the service
            that sends sign-in codes, handle information for us and only for that purpose. They are still to be chosen.
          </li>
          <li>
            <strong>The law.</strong> We will share information if the law requires it.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "privacy-hosting",
    title: "Where it is hosted",
    children: (
      <p>
        The hosting for Vossie is still to be decided. If personal information is stored outside South Africa, POPIA
        section 72 generally allows it where the country, the company or a binding agreement gives it protection at
        least as strong as POPIA, or where you consent. Eduvos will confirm where Vossie&apos;s data lives before
        launch, and this page will say so.
      </p>
    ),
  },
  {
    id: "privacy-rights",
    title: "Your rights",
    children: (
      <>
        <p>Under POPIA you can:</p>
        <ul>
          <li>ask what personal information Vossie holds about you;</li>
          <li>ask for it to be corrected;</li>
          <li>ask for it to be deleted;</li>
          <li>object to Vossie using it;</li>
          <li>take back consent you gave; and</li>
          <li>
            complain to the Information Regulator, at <a href="https://inforegulator.org.za">inforegulator.org.za</a>.
          </li>
        </ul>
        <p>
          You can download your data and delete your account yourself, in your account&apos;s{" "}
          <Link href="/account/privacy">privacy settings</Link>. For anything else, ask the Hub.
        </p>
      </>
    ),
  },
  {
    id: "privacy-contact",
    title: "Contact the Hub",
    children: (
      <>
        <p>
          Questions, or want to use one of your rights? Ask the Incubation Hub team. A contact
          address for privacy requests will be added here before launch.
        </p>
        <p>
          <strong>Information Officer:</strong> to be named by Eduvos.
        </p>
      </>
    ),
  },
  {
    id: "privacy-changes",
    title: "Changes to this policy",
    children: (
      <p>
        This is a draft for Eduvos to review. When Eduvos approves the final version, the banner at the top will go and
        the date will change. If what we collect changes in a way that matters to you, we will tell you before it takes
        effect.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy policy"
      lede="How Vossie handles your personal information, under the Protection of Personal Information Act (POPIA)."
      updated="2026-10-20"
      draft
      sections={SECTIONS}
    />
  );
}

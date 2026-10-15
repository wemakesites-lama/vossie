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
          messages, your reports and your notifications in its memory only, so they are wiped whenever it restarts, and
          no email is sent (the sign-in code shows on the screen). Apart from that, a few small things are kept on your
          own device, so the site can remember your choices.
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
        <h3>Three things kept only in your browser</h3>
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
          <li>Vossie uses no advertising or tracking cookies, and no analytics.</li>
        </ul>
        <p>Clearing your browser&apos;s cookies and site data removes everything listed here.</p>
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
          holds and why, including what selling will add once it opens.
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
            <strong>Your notifications.</strong> A note when someone messages you or a sale needs confirming, which
            only you see. Allowed under POPIA section 11: needed to run your account.
          </li>
          <li>
            <strong>If you sell: your shop and listings.</strong> Shop name, tagline, about text, photos, campus, pickup
            points and what you list, shown to buyers. Hidden location data, such as GPS, is removed from photos you
            upload. Allowed under POPIA section 11: needed to run your shop.
          </li>
          <li>
            <strong>If you are in the Hub&apos;s programme: mentors&apos; notes.</strong> Mentors can keep private notes
            and check-ins about your shop. Only Hub staff can see them, never the seller. Allowed under POPIA section
            11: our legitimate interest in supporting student businesses.
          </li>
          <li>
            <strong>A log of what Hub staff do.</strong> Who approved, hid or paused what, and when, so staff actions can
            be checked. Allowed under POPIA section 11: our legitimate interest in running Vossie fairly.
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
          up to 30 days, 30 minutes and a minute. Your browser keeps the other three things until you clear them.
        </li>
        <li>Your account details stay until you delete your account.</li>
        <li>
          Deleting your account removes your account, your sign-in sessions, your record of consent, your messages,
          your reports and your notifications straight away, along with your shop and listings if you have them. The
          other person in a conversation keeps their own messages, with your name taken out. When the other person is a
          shop that answered you, the times of that conversation (when it was asked, first answered and confirmed) stay
          with the shop, without your name, for its reply and sales badges.
        </li>
        <li>
          While Vossie is a preview, messages, reports and notifications live in the server&apos;s memory and go
          whenever it restarts. Eduvos will set how long they are kept before launch, and this policy will say so.
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
            <strong>Hub staff</strong> can see reports and account details when they need to, to approve sellers and
            keep Vossie safe.
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
      updated="2026-10-15"
      draft
      sections={SECTIONS}
    />
  );
}

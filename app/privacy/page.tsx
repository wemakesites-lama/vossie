import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How CampusCart handles your personal information under POPIA: what this site stores today, what your account holds, who sees it and your rights. A draft for Eduvos to review.",
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
          CampusCart is an Eduvos Incubation Hub project. Under the Protection of Personal Information Act 4 of 2013 (POPIA),
          Eduvos is the responsible party for the personal information collected through CampusCart.
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
          CampusCart runs in two places: a preview, which keeps everything in memory, and the live site. If you sign in on
          the preview, the server keeps your account, your sign-ins, your consent, your staff role if you have one, your
          Looking For requests and the shops you follow, your saved searches, your RSVPs and slot requests, your messages, your
          reports, your notifications and, if you sell, your shop, your
          listings and their photos in its memory only, so they are wiped whenever it restarts, and no email is sent (the sign-in code shows on the
          screen). On the live site, all of this is kept in Supabase&apos;s database until you delete it or Eduvos&apos;s
          retention periods remove it, and the sign-in code is emailed to you. Apart from that, a few small things are kept on your own device, so the site can remember your
          choices.
        </p>
        <h3>Two first-party cookies</h3>
        <p>
          A cookie is a small file your browser keeps and sends back to CampusCart with each page it asks for. These two
          belong to CampusCart and nobody else. Some browsers, such as Safari on an iPhone, clear cookies like these after a
          week.
        </p>
        <ul>
          <li>
            <code>vossie_campus</code>: the campus you chose, so pages can show it first. It lasts up to a year.
          </li>
          <li>
            Your saved listings, in a cookie called <code>vossie_saved</code> that lasts up to a year. Your browser sends
            the listing ids to CampusCart with each visit so the Saved page can show them and your You page can count
            them; nothing is stored on a server.
          </li>
        </ul>
        <h3>Sign-in cookies</h3>
        <p>
          These belong to CampusCart too. The first three can only be read by CampusCart&apos;s server, never by scripts on the
          page.
        </p>
        <ul>
          <li>
            <code>vossie_auth</code>: keeps you signed in on the live site. It holds a signed sign-in token from
            Supabase, our database provider, and may be split into parts named <code>vossie_auth.0</code>,{" "}
            <code>vossie_auth.1</code>. It lasts 30 days from your last visit, so it ends if you don&apos;t use CampusCart
            for 30 days. Signing out or deleting your account ends it.
          </li>
          <li>
            <code>vossie_session</code>: does the same on the preview: a random code that keeps you signed in, for up
            to 30 days. CampusCart&apos;s server keeps only a fingerprint of it, made with a secret key, so the code
            can&apos;t be read back from the server&apos;s records. Signing out or deleting your account ends it.
          </li>
          <li>
            <code>vossie_signin</code>: a random code that holds your place while you sign in, for up to 30 minutes.
          </li>
          <li>
            <code>vossie_flash</code>: a one-off message such as &quot;You&apos;re signed out&quot;, for up to a minute.
          </li>
        </ul>
        <h3>Four things kept only in your browser</h3>
        <p>These stay in your browser&apos;s own storage. They are never sent to CampusCart.</p>
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
            <code>vossie_offline</code>: a copy of CampusCart&apos;s offline page, kept by CampusCart&apos;s service worker so
            an installed CampusCart can say you&apos;re offline instead of showing an error. It holds nothing about you and
            no page you looked at.
          </li>
        </ul>
        <h3>What else happens</h3>
        <ul>
          <li>
            When you search, the words you type are sent to CampusCart in the page address (for example{" "}
            <code>/browse?q=calculator</code>), so it can find results.
          </li>
          <li>
            Vercel, which hosts CampusCart, keeps ordinary server logs (page addresses, times and technical details of
            each request) to keep the site running and secure.
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
          <li>CampusCart uses no advertising or tracking cookies, and no analytics.</li>
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
          You need an account to message, sell, report, post on Looking For, follow shops, save searches and RSVP to
          the Hub. Later, keeping your saved listings on every device will need one too. This is what your account
          holds, and why.
        </p>
        <ul>
          <li>
            <strong>Your Eduvos email address.</strong> To check that you are an Eduvos student and to send you sign-in
            codes. A sign-in code is kept only as a fingerprint made with a secret key, and only until you finish
            signing in or the attempt runs out after 30 minutes. In this preview the code shows on screen instead of
            being emailed, so until the attempt ends it&apos;s also kept as written. On the live site, CampusCart doesn&apos;t
            keep the code at all: it&apos;s emailed to you, and Supabase keeps only a fingerprint of it, for the 10
            minutes it works. Allowed under POPIA section 11: it
            is needed to run the account you ask for.
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
            <strong>A sign-in cookie and your sign-ins.</strong> The cookie keeps you signed in for 30 days from your
            last visit (up to 30 days on the preview). Supabase Auth keeps security records of your sign-ins (the IP
            address and browser) for 30 days, and they go within a day of your account being deleted. To stop one
            network sending too many sign-in emails, the live site counts the codes sent from each IP address for about
            an hour, keeping only a fingerprint of the address made with a secret key. Allowed under POPIA section 11:
            needed to run your account, and our legitimate interest in keeping accounts secure.
          </li>
          <li>
            <strong>Your messages, swap offers and reports.</strong> To pass them to the other person, to work out reply
            times for trust badges, and to keep CampusCart safe. Allowed under POPIA section 11: needed to run the service,
            and our legitimate interest in keeping students safe.
          </li>
          <li>
            <strong>Your RSVPs and slot requests.</strong> When you say you&apos;re going to a Hub event or ask for a
            slot at office hours, we keep that, what you&apos;d like help with and the time that suits, so the Hub can
            plan and a mentor can answer. Hub staff see your first name with a request. Allowed under POPIA section 11:
            needed to give you what you asked for.
          </li>
          <li>
            <strong>Your notifications.</strong> A note when someone messages you, a sale needs confirming, a shop
            offers to help with your request, a shop you follow lists something new, a search you saved has a new
            match, the Hub acts on your report, your shop, your listing or your request, your request is about to
            close automatically, or does, a mentor answers your slot request, someone asks for a slot at your office
            hours, your staff role changes, or an admin asks you to mentor a shop. Only you see them.
            Allowed under POPIA section 11: needed to run your account.
          </li>
          <li>
            <strong>Your Looking For requests.</strong> What you ask for, shown to everyone as &quot;Asked by a student
            at&quot; your campus, never with your name. CampusCart keeps which account asked, so only you can change or
            delete it. Allowed under POPIA section 11: needed to run the service you ask for. An open request closes
            automatically 3 days after its needed-by date, or after 30 days with no changes; you&apos;re reminded 2
            days before and told when it does, and you can reopen it.
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
            before CampusCart keeps it: only what a photo needs to show properly, such as its colours and which way up it
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
            lose your name and the reason. Allowed under POPIA section 11: our legitimate interest in running CampusCart
            fairly.
          </li>
          <li>
            <strong>If you&apos;re Hub staff: your role.</strong> Whether you&apos;re a mentor or an admin. A Hub admin
            gives the role using your exact Eduvos email, and Hub admins see the first name, email and campus of
            everyone with a role. Nobody can search or list students who don&apos;t have one. Allowed under POPIA
            section 11: our legitimate interest in running CampusCart safely.
          </li>
        </ul>
        <p>CampusCart does not ask for your ID number, your bank details or your home address.</p>
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
          30 days from your last visit (up to 30 days on the preview), 30 minutes and a minute. Your browser keeps the other four things until you clear them.
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
          While CampusCart is a preview, Looking For requests, follows, saved searches, messages, reports, notifications, shops, listings
          and photos live in the server&apos;s memory and go whenever it restarts. On the live site, they&apos;re kept in
          Supabase&apos;s database until you delete them or Eduvos&apos;s retention periods remove them. Eduvos will set how long they are kept before launch, and
          this policy will say so.
        </li>
        <li>
          Supabase&apos;s records of sign-ins in CampusCart&apos;s database are kept for 30 days, and go within a day of an
          account&apos;s deletion. Server logs, and Vercel&apos;s and Supabase&apos;s own platform logs, are kept for a
          limited time, set by Vercel and Supabase. Resend keeps its logs of the sign-in emails it sends for its own
          retention period. Eduvos will confirm these periods before launch, and this policy will say so.
        </li>
      </ul>
    ),
  },
  {
    id: "privacy-sharing",
    title: "Who it is shared with",
    children: (
      <>
        <p>CampusCart does not sell personal information to anyone, and does not share it for advertising.</p>
        <ul>
          <li>
            <strong>Other students</strong> see only what they need. A seller&apos;s shop name, photos and listings are
            public. A buyer&apos;s first name is shown to the seller they message. Requests on the Looking For board say
            &quot;a student&quot;, never a name.
          </li>
          <li>
            <strong>Hub staff</strong> can see reports, account details, RSVPs and slot requests when they need to, to
            approve sellers, run the Hub&apos;s events and keep CampusCart safe. A mentor sees your shop&apos;s numbers,
            never your messages.{" "}
            Hub admins see weekly counts for each campus (listings, shops, requests, enquiries, reports and follows),
            never who; small numbers are hidden so no one can be picked out.
          </li>
          <li>
            <strong>Service providers</strong> that run CampusCart for Eduvos handle information for us and only for that
            purpose: Supabase (the database and sign-in), Vercel (hosting) and Resend (sign-in emails).
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
        CampusCart&apos;s data is stored by Supabase in Ireland (Amazon Web Services, eu-west-1), and its pages are served
        by Vercel, whose servers that handle your requests are in Dublin. Sign-in codes are emailed by Resend, in the
        United States, which keeps your email address and the email in its logs for its retention period. Storing or
        sending personal information outside South Africa is allowed under POPIA section 72 where the country, the
        company or a binding agreement gives it protection at least as strong as POPIA; Supabase&apos;s, Vercel&apos;s
        and Resend&apos;s data processing agreements are the binding agreements CampusCart relies on. Eduvos will confirm
        this before launch.
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
          <li>ask what personal information CampusCart holds about you;</li>
          <li>ask for it to be corrected;</li>
          <li>ask for it to be deleted;</li>
          <li>object to CampusCart using it;</li>
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
      lede="How CampusCart handles your personal information, under the Protection of Personal Information Act (POPIA)."
      updated="2026-10-21"
      draft
      sections={SECTIONS}
    />
  );
}

import Link from "next/link";
import { Pennant } from "@/components/brand/Pennant";
import { ArrowUpRightIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import type { Campus } from "@/lib/types";
import { FitText } from "./FitText";
import { InstallButton } from "./InstallButton";
import { NewsletterForm } from "./NewsletterForm";

type FooterLink = {
  href: string;
  label: string;
  /** `false` where following the link should not download its route when the footer scrolls into view. */
  prefetch?: false;
};
type LinkGroup = {
  title: string;
  links: readonly FooterLink[];
  /** Two columns from the desktop step (decision 17). */
  columns?: boolean;
};

const LINK_GROUPS: readonly LinkGroup[] = [
  {
    title: "Shop",
    links: [
      { href: "/browse", label: "Browse everything" },
      { href: "/browse?cat=textbooks-notes", label: "Textbooks & notes" },
      { href: "/browse?cat=tech", label: "Tech" },
      { href: "/browse?cat=services", label: "Services" },
      { href: "/looking-for", label: "Looking For" },
      // No prefetch, as with the header's Saved link: the footer is on every page, and prefetching Saved would download
      // its route chunk (about 0.6 KB) on each one once the footer scrolls into view on desktop and tablet.
      { href: "/saved", label: "Saved", prefetch: false },
    ],
  },
  {
    title: "Sell",
    links: [
      { href: "/sell", label: "List an item" },
      { href: "/how-it-works", label: "How selling works" },
      { href: "/hub", label: "Launchpad" },
      { href: "/seller-guidelines", label: "Seller guidelines" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/safety", label: "Safety" },
      { href: "/trust", label: "How trust works" },
      { href: "/privacy", label: "Privacy (POPIA)" },
      { href: "/terms", label: "Terms of use" },
      { href: "/account", label: "Your account" },
    ],
  },
];

/** The info list at the foot (phone footer spec 3): all six on phones; from the wide step the columns hold the first
    three, so only the legal three show, in the order the legal row always had. */
const INFO_LINKS: readonly (FooterLink & { phoneOnly?: true })[] = [
  { href: "/how-it-works", label: "How it works", phoneOnly: true },
  { href: "/trust", label: "How trust works", phoneOnly: true },
  { href: "/seller-guidelines", label: "Seller guidelines", phoneOnly: true },
  { href: "/privacy", label: "Privacy (POPIA)" },
  { href: "/terms", label: "Terms of use" },
  { href: "/safety", label: "Safety" },
];

/** The bold footer (spec section 6.6); on phones the slim one (phone footer spec 3). */
export function SiteFooter({ campuses }: { campuses: readonly Campus[] }) {
  const groups: readonly LinkGroup[] = [
    ...LINK_GROUPS,
    {
      title: "Campuses",
      columns: true,
      links: campuses.map((campus) => ({ href: `/browse?campus=${campus.slug}`, label: campus.name })),
    },
  ];

  return (
    <footer className="site-footer surface-navy texture-stars">
      <div className="footer-inner">
        <h2 className="sr-only">Site links</h2>
        {/* Phones have Shop and Sell in the tab bar (phone footer spec 3). */}
        <div className="footer-giants hidden wide:grid">
          {/* /browse opens on the chosen campus by itself, so this needs no client code (plan decision 12). */}
          <Link href="/browse" className="footer-giant">
            Shop your campus
            <ArrowUpRightIcon className="footer-giant-arrow" />
          </Link>
          <Link href="/sell" className="footer-giant">
            Start selling
            <ArrowUpRightIcon className="footer-giant-arrow" />
          </Link>
        </div>

        <div className="footer-grid">
          <section aria-labelledby="footer-updates-title" className="footer-updates">
            <h3 id="footer-updates-title" tabIndex={-1} className="footer-heading">
              Campus updates
            </h3>
            <p className="footer-copy">New listings, Hub events and safety tips from your campus, once a week.</p>
            <NewsletterForm />
            <InstallButton />
          </section>

          {/* Phones reach every one of these links through the tab bar, the menu or the header (phone footer spec 2). */}
          {groups.map((group) => (
            <div key={group.title} className="footer-group hidden wide:block">
              <h3 className="footer-heading">{group.title}</h3>
              <FooterLinks links={group.links} columns={group.columns} />
            </div>
          ))}
        </div>

        <div className="footer-legal">
          <ul className="footer-legal-links">
            {INFO_LINKS.map((link) => (
              <li key={link.href} className={link.phoneOnly ? "footer-phone-only wide:hidden" : undefined}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
          <div className="footer-lock">
            <Pennant size="small" />
            <p>An Eduvos Incubation Hub project</p>
          </div>
        </div>
      </div>
      <div className="footer-wordmark" aria-hidden="true">
        <FitText className="footer-wordmark-text">CAMPUSCART</FitText>
      </div>
    </footer>
  );
}

function FooterLinks({ links, columns = false }: { links: readonly FooterLink[]; columns?: boolean }) {
  return (
    <ul className={cx("footer-links", columns && "footer-links-columns")}>
      {links.map((link) => (
        <li key={`${link.href}-${link.label}`}>
          <Link href={link.href} prefetch={link.prefetch}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

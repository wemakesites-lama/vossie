import Link from "next/link";
import { Pennant } from "@/components/brand/Pennant";
import { ArrowUpRightIcon, ChevronDownIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import type { Campus } from "@/lib/types";
import { FitText } from "./FitText";
import { InstallButton } from "./InstallButton";
import { NewsletterForm } from "./NewsletterForm";
import { ShopYourCampusLink } from "./ShopYourCampusLink";

type FooterLink = { href: string; label: string };
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
      { href: "/categories/textbooks-notes", label: "Textbooks & notes" },
      { href: "/categories/tech", label: "Tech" },
      { href: "/categories/services", label: "Services" },
      { href: "/looking-for", label: "Looking For" },
      { href: "/saved", label: "Saved" },
    ],
  },
  {
    title: "Sell",
    links: [
      { href: "/sell", label: "List an item" },
      { href: "/how-it-works", label: "How selling works" },
      { href: "/hub", label: "Incubation Hub" },
      { href: "/safety", label: "Seller safety" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/safety", label: "Safety" },
      { href: "/privacy", label: "Privacy (POPIA)" },
      { href: "/account", label: "Your account" },
    ],
  },
];

/** The bold footer (spec section 6.6). */
export function SiteFooter({ campuses }: { campuses: readonly Campus[] }) {
  const groups: readonly LinkGroup[] = [
    ...LINK_GROUPS,
    {
      title: "Campuses",
      columns: true,
      links: campuses.map((campus) => ({ href: `/c/${campus.slug}`, label: campus.name })),
    },
  ];

  return (
    <footer className="site-footer surface-navy texture-stars">
      <div className="footer-inner">
        <h2 className="sr-only">Site links</h2>
        <div className="footer-giants">
          <ShopYourCampusLink campuses={campuses} />
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

          {groups.map((group) => (
            <div key={group.title} className="footer-group">
              <details className="footer-accordion wide:hidden">
                <summary className="footer-summary">
                  {group.title}
                  <ChevronDownIcon className="footer-summary-icon" />
                </summary>
                <FooterLinks links={group.links} />
              </details>
              <div className="hidden wide:block">
                <h3 className="footer-heading">{group.title}</h3>
                <FooterLinks links={group.links} columns={group.columns} />
              </div>
            </div>
          ))}
        </div>

        <div className="footer-legal">
          <div className="footer-lock">
            <Pennant size="small" />
            <p>An Eduvos Incubation Hub project</p>
          </div>
          <p className="footer-legal-links">
            <Link href="/privacy">Privacy (POPIA)</Link> · <Link href="/safety">Safety</Link>
          </p>
        </div>
      </div>
      <div className="footer-wordmark" aria-hidden="true">
        <FitText className="footer-wordmark-text">VOSSIE</FitText>
      </div>
    </footer>
  );
}

function FooterLinks({ links, columns = false }: { links: readonly FooterLink[]; columns?: boolean }) {
  return (
    <ul className={cx("footer-links", columns && "footer-links-columns")}>
      {links.map((link) => (
        <li key={`${link.href}-${link.label}`}>
          <Link href={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );
}

import Link from "next/link";
import { FlagIcon, MapPinIcon, ShieldIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { SectionHeader } from "./SectionHeader";

type Step = { title: string; body: string };

const BUYING: readonly Step[] = [
  { title: "Find it on your campus", body: "Search, browse categories, or shop every campus." },
  { title: "Message the seller", body: "Chat in CampusCart. Offer a swap if they accept one." },
  { title: "Meet at a pickup point", body: "See it first, then pay or swap on the spot." },
];

const SELLING: readonly Step[] = [
  { title: "Set up your shop", body: "About three minutes, from your phone." },
  { title: "Get approved by the Hub", body: "The Incubation Hub checks every new seller." },
  { title: "List, chat, hand over", body: "Earn badges as buyers confirm your sales." },
];

const SAFETY = [
  { Icon: ShieldIcon, label: "Verified sellers" },
  { Icon: MapPinIcon, label: "Approved pickup points" },
  { Icon: FlagIcon, label: "Never pay before you see it" },
];

/** How it works (spec 7.9). */
export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="home-section">
      <SectionHeader id="how" eyebrow="How CampusCart works" title="Safe, simple, on campus" align="center" />
      <div className="how-grid">
        <HowCard title="Buying" steps={BUYING} action={{ href: "/browse", label: "Start shopping" }} tone="grey" />
        <HowCard title="Selling" steps={SELLING} action={{ href: "/sell", label: "Start selling" }} tone="navy" />
      </div>
      <ul aria-label="How CampusCart keeps you safe" className="safety-row">
        {SAFETY.map(({ Icon, label }) => (
          <li key={label}>
            <Icon className="safety-icon" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

type HowCardProps = {
  title: string;
  steps: readonly Step[];
  action: { href: string; label: string };
  tone: "grey" | "navy";
};

function HowCard({ title, steps, action, tone }: HowCardProps) {
  return (
    <div className={cx("how-card", tone === "navy" ? "surface-navy texture-stars how-card-navy" : "how-card-grey")}>
      <h3 className="how-card-title">{title}</h3>
      <ol className="how-steps">
        {steps.map((step, n) => (
          <li key={step.title} className="how-step">
            <span className="how-step-number" aria-hidden="true">
              {n + 1}
            </span>
            <span>
              <strong className="how-step-title">{step.title}</strong>
              <span className="how-step-body">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link href={action.href} className={cx("btn how-card-action", tone === "navy" ? "btn-sky" : "btn-primary")}>
        {action.label}
      </Link>
    </div>
  );
}

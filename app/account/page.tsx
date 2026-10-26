import type { Metadata } from "next";
import { YouSkeleton } from "@/components/account/AccountSkeleton";
import { YouView } from "@/components/account/AccountView";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses } from "@/lib/data";
import { YOU_PATH } from "@/lib/you/paths";
import { readForYou, readYourStuff } from "@/lib/you/read";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

/** One person's hub, so search engines leave it out (accounts spec 3.3; `/account` is in robots.txt too). */
export const metadata: Metadata = { title: "You", robots: { index: false } };

/**
 * You (role views spec 7.4): everything needs the session, so the static shell is the skeleton and the page renders per
 * request inside <Suspense> (plan decision 13). A signed-out visitor is sent to sign in, and comes back here (spec 2.10).
 */
export default function YouPage() {
  return (
    <PageTransition>
      <div className="page account-page you-page">
        <Trail crumbs={trailFor("/account")} />
        <Reveal fallback={<YouSkeleton />}>
          <YouContent />
        </Reveal>
      </div>
    </PageTransition>
  );
}

async function YouContent() {
  const account = await requireAccount(YOU_PATH);
  // requireAccount awaited connection() as it found the session, so the readers may read the clock (decision 26).
  const now = new Date();
  // Each card's read fails on its own: its card says so, and the rest of the page works (role views spec 8).
  const [campuses, forYou, stuff] = await Promise.all([
    getCampuses().catch(() => []),
    readForYou(account.id).catch(() => null),
    readYourStuff(account.id, now).catch(() => null),
  ]);
  const campusName = campuses.find((campus) => campus.slug === account.campusSlug)?.name ?? "No campus chosen";
  return <YouView account={account} campusName={campusName} forYou={forYou} stuff={stuff} />;
}

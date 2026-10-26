import type { Metadata } from "next";
import Link from "next/link";
import { SignIn } from "@/components/auth/SignIn";
import { SignInSkeleton } from "@/components/auth/SignInSkeleton";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { NavPending } from "@/components/ui/NavPending";
import { backPathFor } from "@/lib/messaging/paths";
import { BACK } from "@/lib/motion";
import { safeNextPath } from "@/lib/next-path";

/** Signing in belongs to one visitor, so search engines leave it out (accounts spec 3.1). */
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/**
 * Sign in (accounts spec 3.1). The heading is prerendered; the card for this browser's state and the link back to
 * `next` render per request inside <Suspense>.
 */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <PageTransition>
      <div className="page signin-page">
        <h1 className="signin-title">Sign in</h1>
        <Reveal fallback={<SignInSkeleton />}>
          <SignInForVisitor searchParams={searchParams} />
        </Reveal>
      </div>
    </PageTransition>
  );
}

async function SignInForVisitor({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  // A composer's or a report form's `next` leads back to its listing, shop or request, and a page that needs an
  // account gets no back link, since it would only come back here (messaging plan decision 4).
  const back = next ? backPathFor(next) : null;
  return (
    <>
      <SignIn next={next} />
      {/* Back to where the visitor came from, when that's a path on this site (browse and listing spec 5.9). */}
      {back && (
        <p className="signin-back">
          <Link href={back} transitionTypes={BACK}>
            {back.startsWith("/listings/") ? "Back to the listing" : "Go back"}
            <NavPending />
          </Link>
        </p>
      )}
    </>
  );
}

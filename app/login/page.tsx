import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignIn } from "@/components/auth/SignIn";
import { SignInSkeleton } from "@/components/auth/SignInSkeleton";
import { safeNextPath } from "@/lib/next-path";

/** Signing in belongs to one visitor, so search engines leave it out (accounts spec 3.1). */
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/**
 * Sign in (accounts spec 3.1). The heading is prerendered; the card for this browser's state and the link back to
 * `next` render per request inside <Suspense>.
 */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="page signin-page">
      <h1 className="signin-title">Sign in</h1>
      <Suspense fallback={<SignInSkeleton />}>
        <SignInForVisitor searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SignInForVisitor({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  return (
    <>
      <SignIn next={next} />
      {/* Back to where the visitor came from, when that's a path on this site (browse and listing spec 5.9). */}
      {next && (
        <p className="signin-back">
          <Link href={next}>{next.startsWith("/listings/") ? "Back to the listing" : "Go back"}</Link>
        </p>
      )}
    </>
  );
}

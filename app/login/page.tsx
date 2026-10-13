import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { safeNextPath } from "@/lib/next-path";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <ComingSoon title="Sign in">
      <p>
        Signing in arrives in the next stage. Then you&apos;ll be able to message sellers, report listings and keep your
        saved items on every device.
      </p>
      <Suspense fallback={null}>
        <BackLink searchParams={searchParams} />
      </Suspense>
    </ComingSoon>
  );
}

/** A link back to where the visitor came from, when `next` is a path on this site (spec 5.9). */
async function BackLink({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  if (!next) return null;
  return (
    <p className="mt-4">
      <Link href={next} className="font-semibold text-sky-dark underline underline-offset-4">
        {next.startsWith("/listings/") ? "Back to the listing" : "Go back"}
      </Link>
    </p>
  );
}

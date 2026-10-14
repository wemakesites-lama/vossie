import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BoardSkeleton } from "@/components/looking-for/BoardSkeleton";
import { RequestBoard } from "@/components/looking-for/RequestBoard";
import { signInHref } from "@/lib/next-path";

/** Fixed: `?cat=` views share the board's title and description, and stay indexed (plan decision 14). */
export const metadata: Metadata = {
  title: "Looking For",
  description: "Post what you need, and students who can help will offer. Open requests from every Eduvos campus.",
};

/**
 * The Looking For board (community spec 4.1). The heading is prerendered; the chips and requests read the campus
 * cookie and `?cat=`, so they stream in behind a skeleton. Posting needs an account, so Post a request goes to the
 * sign-in page and comes back to the board (community spec decision 1, plan decision 19).
 */
export default function LookingForPage({ searchParams }: PageProps<"/looking-for">) {
  return (
    <div className="page board">
      <div className="board-head">
        <h1 className="board-title">Looking For</h1>
        <p className="board-lede">Post what you need, and students who can help will offer.</p>
        <Link href={signInHref("/looking-for")} prefetch={false} className="btn btn-primary board-post">
          Post a request
        </Link>
      </div>
      <Suspense fallback={<BoardSkeleton />}>
        <RequestBoard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

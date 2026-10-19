import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardSkeleton } from "@/components/looking-for/BoardSkeleton";
import { PostRequestLink } from "@/components/looking-for/PostRequestLink";
import { RequestBoard } from "@/components/looking-for/RequestBoard";

/** Fixed: `?cat=` views share the board's title and description, and stay indexed (plan decision 14). */
export const metadata: Metadata = {
  title: "Looking For",
  description: "Post what you need, and students who can help will offer. Open requests from every Eduvos campus.",
};

/**
 * The Looking For board (community spec 4.1). The heading is prerendered; the chips and requests read the campus
 * cookie and `?cat=`, so they stream in behind a skeleton. Post a request follows the session: through sign-in and
 * back to the request form when signed out, the form itself when signed in (community actions spec section 3).
 */
export default function LookingForPage({ searchParams }: PageProps<"/looking-for">) {
  return (
    <div className="page board">
      <div className="board-head">
        <h1 className="board-title">Looking For</h1>
        <p className="board-lede">Post what you need, and students who can help will offer.</p>
        <PostRequestLink className="btn btn-primary board-post">Post a request</PostRequestLink>
      </div>
      <Suspense fallback={<BoardSkeleton />}>
        <RequestBoard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

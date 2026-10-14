import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { budgetLabel, offersLabel } from "@/lib/format";
import { shortSastDate } from "@/lib/time";
import type { LookingForRequest } from "@/lib/types";

type RequestRowProps = {
  request: LookingForRequest;
  campusName: string;
  categoryName: string;
};

/**
 * One request on the board (community spec 4.1): the title, then where, what and the budget, then when it was posted
 * and how many offers it has. The title's link covers the whole row. It names no one (community spec decision 2).
 */
export function RequestRow({ request, campusName, categoryName }: RequestRowProps) {
  return (
    <article className="board-row">
      <h3 className="board-row-title">
        {/* No prefetch: a list of requests, most of which won't be opened (decision 28). */}
        <Link href={`/looking-for/${request.id}`} prefetch={false} className="board-row-link">
          {request.title}
        </Link>
      </h3>
      <p className="board-row-meta">
        {campusName} · {categoryName} · {budgetLabel(request)}
      </p>
      <p className="board-row-meta">
        Posted <time dateTime={request.createdAt}>{shortSastDate(request.createdAt)}</time> ·{" "}
        {offersLabel(request.offers)}
      </p>
      <ArrowRightIcon className="board-row-arrow" />
    </article>
  );
}

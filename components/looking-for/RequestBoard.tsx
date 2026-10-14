import Link from "next/link";
import type { ReactNode } from "react";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { getCampuses, getCategories, getOpenRequests } from "@/lib/data";
import { isOnlineCampus } from "@/lib/campus";
import { getViewerContext } from "@/lib/data/viewer";
import { signInHref } from "@/lib/next-path";
import { boardHref, readRequestCategory, splitByCampus } from "@/lib/requests";
import type { CampusChoice, LookingForRequest } from "@/lib/types";
import { RequestRow } from "./RequestRow";

type Names = { campuses: ReadonlyMap<string, string>; categories: ReadonlyMap<string, string> };

type RequestBoardProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The Looking For board's body (community spec 4.1): the category chips, then the open requests, the viewer's campus
 * first. It reads the campus cookie and `?cat=`, so it renders per request, inside the page's <Suspense>. If the
 * requests don't load, the chips still work.
 */
export async function RequestBoard({ searchParams }: RequestBoardProps) {
  const [params, viewer, campuses, categories] = await Promise.all([
    searchParams,
    getViewerContext(),
    getCampuses(),
    getCategories(),
  ]);
  const category = readRequestCategory(params.cat, categories);
  const requests = await getOpenRequests({ category }).catch(() => null);
  const names: Names = {
    campuses: new Map(campuses.map((campus) => [campus.slug, campus.name])),
    categories: new Map(categories.map((item) => [item.slug, item.name])),
  };

  let body: ReactNode;
  if (requests === null) {
    body = (
      <div className="section-error">
        <p>We couldn&apos;t load requests just now.</p>
        <a href={boardHref(category)} className="btn btn-outline text-navy">
          Try again
        </a>
      </div>
    );
  } else if (requests.length === 0) {
    body = (
      <div className="board-empty">
        <p>No requests here yet. Be the first to ask.</p>
        <Link href={signInHref("/looking-for")} prefetch={false} className="btn btn-primary">
          Post a request
        </Link>
      </div>
    );
  } else {
    body = <BoardLists requests={requests} campus={viewer.campus} names={names} />;
  }

  const chips = [
    { key: "all", label: "All", href: boardHref(null) },
    ...categories.map((item) => ({ key: item.slug, label: item.name, href: boardHref(item.slug) })),
  ];

  return (
    <>
      <LinkTabs label="Categories" tabs={chips} current={category ?? "all"} look="chips" />
      {body}
    </>
  );
}

type BoardListsProps = { requests: readonly LookingForRequest[]; campus: CampusChoice; names: Names };

/** One list with no campus chosen; otherwise the viewer's campus, then every other (community spec 4.1). */
function BoardLists({ requests, campus, names }: BoardListsProps) {
  const split = splitByCampus(requests, campus);
  if (split === null) {
    return (
      <BoardSection id="board-all" title="Open requests">
        <RequestList requests={requests} names={names} />
      </BoardSection>
    );
  }

  const campusName = names.campuses.get(campus) ?? "";
  // Eduvos Online has no ground to be "at": it reads "On Eduvos Online". Every other campus keeps "At …".
  const online = isOnlineCampus({ slug: campus });
  return (
    <>
      <BoardSection id="board-own" title={`${online ? "On" : "At"} ${campusName}`}>
        {split.own.length > 0 ? (
          <RequestList requests={split.own} names={names} />
        ) : (
          <p className="board-none">
            Nothing {online ? "on" : "at"} {campusName} yet.
          </p>
        )}
      </BoardSection>
      {split.others.length > 0 && (
        <BoardSection id="board-others" title="Other campuses">
          <RequestList requests={split.others} names={names} />
        </BoardSection>
      )}
    </>
  );
}

function BoardSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="board-section">
      <h2 id={`${id}-title`} className="listing-section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

function RequestList({ requests, names }: { requests: readonly LookingForRequest[]; names: Names }) {
  return (
    <ul className="board-list">
      {requests.map((request) => (
        <li key={request.id}>
          <RequestRow
            request={request}
            campusName={names.campuses.get(request.campusSlug) ?? ""}
            categoryName={names.categories.get(request.categorySlug) ?? ""}
          />
        </li>
      ))}
    </ul>
  );
}

import Link from "next/link";
import { ListingCard } from "@/components/listings/ListingCard";
import { getCampuses } from "@/lib/data";
import { starterPackFor } from "@/lib/data/starter-pack";
import { getViewerContext } from "@/lib/data/viewer";
import type { BrowseParams } from "@/lib/browse/query";
import {
  NO_FIT,
  shopSearchHref,
  STARTER_PATH,
  STARTER_SENTENCE_MAX,
  totalLine,
  typedSentence,
  type Pack,
} from "@/lib/browse/starter";
import { ALL_CAMPUSES } from "@/lib/campus";
import { formatRand } from "@/lib/format";
import type { CampusChoice } from "@/lib/types";

/** The form's room while the page streams in: wordless, no taller than the empty form, its shortest state (CLAUDE.md). */
export function StarterSkeleton() {
  return (
    <div aria-hidden="true" className="starter-skeleton">
      <span className="skeleton starter-skeleton-label" />
      <span className="skeleton starter-skeleton-hint" />
      <span className="skeleton starter-skeleton-field" />
      <span className="skeleton starter-skeleton-button" />
    </div>
  );
}

/** One sentence field and a button: a plain GET form, so it works before (or without) the app's JavaScript. */
function StarterForm({ sentence }: { sentence: string | null }) {
  return (
    <form action={STARTER_PATH} method="get" className="starter-form">
      <div className="form-field">
        <label htmlFor="starter-q" className="form-label">
          What do you need?
        </label>
        <p id="starter-hint" className="form-hint">
          One sentence: where, your budget and what you need. For example, &ldquo;Starting at Midrand, need things for
          res under R1500.&rdquo;
        </p>
        <input
          id="starter-q"
          name="q"
          type="text"
          required
          maxLength={STARTER_SENTENCE_MAX}
          defaultValue={sentence ?? ""}
          autoComplete="off"
          enterKeyHint="go"
          aria-describedby="starter-hint"
          className="form-input"
        />
      </div>
      <button type="submit" className="btn btn-primary starter-button">
        Make my pack
      </button>
    </form>
  );
}

/** The read failed, the cap is full or a search threw (planning decision 9): Browse with the sentence instead. */
function StarterFailed({ sentence }: { sentence: string }) {
  const href = shopSearchHref(sentence);
  // The words the link searches: the sentence cut to Browse's 100 characters, so the text never promises more.
  const searched = new URLSearchParams(href.slice(href.indexOf("?") + 1)).get("q") ?? sentence;
  return (
    <section aria-labelledby="starter-failed-title" className="starter-failed">
      <h2 id="starter-failed-title" className="starter-pack-title">
        We couldn&apos;t make a pack
      </h2>
      <p>Try naming the things you need, or search Shop instead.</p>
      <p>
        <Link href={href} prefetch={false} className="starter-link">
          Search Shop for &ldquo;{searched}&rdquo;
        </Link>
      </p>
    </section>
  );
}

function StarterLines({
  pack,
  campus,
  campusNames,
}: {
  pack: Pack;
  campus: CampusChoice;
  campusNames: ReadonlyMap<string, string>;
}) {
  const where = campus === ALL_CAMPUSES ? "every campus" : (campusNames.get(campus) ?? "every campus");
  const total = totalLine(pack);
  return (
    <section aria-labelledby="starter-pack-title" className="starter-pack">
      <h2 id="starter-pack-title" className="starter-pack-title">
        Your starter pack
      </h2>
      <p className="starter-place">
        At {where} · {pack.budget === null ? "No budget given" : `Budget ${formatRand(pack.budget)}`}
      </p>
      <ol className="starter-lines">
        {pack.lines.map((line, n) => (
          <li key={`${line.item.words}-${n}`} className="starter-line">
            <h3 className="starter-item">{line.item.name}</h3>
            {line.kind === "pick" && (
              <ListingCard
                listing={line.listing}
                campusName={campusNames.get(line.listing.campusSlug) ?? ""}
                titleTag="h4"
              />
            )}
            {line.kind === "no-fit" && <p className="starter-note">{NO_FIT[line.reason]}</p>}
            {line.kind === "none" && <p className="starter-note">Nothing on CampusCart yet.</p>}
            <p className="starter-links">
              {line.kind === "none" ? (
                <Link href={line.ask} prefetch={false} className="starter-link">
                  Ask for it on Looking For<span className="sr-only">: {line.item.name}</span>
                </Link>
              ) : (
                <Link href={line.seeMore} prefetch={false} className="starter-link">
                  See more<span className="sr-only">: {line.item.name}</span>
                </Link>
              )}
            </p>
          </li>
        ))}
      </ol>
      {total && <p className="starter-total">{total}</p>}
      {pack.fromPrices && <p className="starter-note">Prices marked From can cost more.</p>}
    </section>
  );
}

/**
 * The starter pack's body (AI round two spec section 6). It reads the link and the viewer's campus, so it renders per
 * request inside the page's Reveal: the form with the sentence, then the pack or the failure. Only the sentence ever
 * reaches the model; the campus cookie is used here, on the server.
 */
export async function StarterView({ searchParams }: { searchParams: Promise<BrowseParams> }) {
  const [params, viewer, campuses] = await Promise.all([searchParams, getViewerContext(), getCampuses()]);
  const sentence = typedSentence(params.q);
  const outcome = await starterPackFor(sentence, viewer.campus);
  const campusNames = new Map(campuses.map((campus) => [campus.slug, campus.name]));
  return (
    <>
      <StarterForm sentence={sentence} />
      {outcome.kind === "failed" && <StarterFailed sentence={outcome.sentence} />}
      {outcome.kind === "pack" && <StarterLines pack={outcome.pack} campus={outcome.campus} campusNames={campusNames} />}
    </>
  );
}

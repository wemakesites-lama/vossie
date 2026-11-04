import Link from "next/link";

/**
 * "Showing calculator under R500 at Midrand. Search for exactly what I typed" (AI features spec 6): above the results
 * when a sentence search was read into filters. The link reloads Browse in place, like the empty state's links.
 */
export function WordsLine({ line, exactHref }: { line: string; exactHref: string }) {
  return (
    <p className="browse-words">
      {line}{" "}
      <Link href={exactHref} prefetch={false}>
        Search for exactly what I typed
      </Link>
    </p>
  );
}

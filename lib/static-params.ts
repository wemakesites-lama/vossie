// generateStaticParams with Cache Components must give at least one value (CLAUDE.md), and a build reads the data
// (2b plan decision 23). On Supabase a new project starts empty, so a list of ids can be empty: a placeholder value
// stands in, as /sell/listings/[id]/edit's "l-sample" does (2b plan amendment 16, Task 17b). No row has it, so its page
// is the 404: every one of these routes calls notFound() for an unknown value.

/** The values to prerender, or the placeholder alone when there are none. */
export function atLeastOne<T>(values: readonly T[], placeholder: T): T[] {
  return values.length > 0 ? [...values] : [placeholder];
}

/** The placeholders, one per kind of page: values no row has. */
export const PLACEHOLDER_PARAMS = {
  listing: { id: "l-sample" },
  seller: { slug: "sample-shop" },
  collection: { slug: "sample-collection" },
  request: { id: "r-sample" },
  hubPost: { id: "h-sample" },
} as const;

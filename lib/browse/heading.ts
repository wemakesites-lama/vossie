export type BrowseHeading = {
  eyebrow: string;
  heading: string;
  /** The tab title, before the layout adds " · Vossie". */
  title: string;
};

/** The browse page's eyebrow, h1 and tab title (spec 4.1). A search is wrapped in curly quotes. */
export function browseHeading(q: string | null, categoryName: string | null): BrowseHeading {
  if (q) {
    const quoted = `“${q}”`;
    return { eyebrow: categoryName ? `Search in ${categoryName}` : "Search", heading: quoted, title: quoted };
  }
  if (categoryName) return { eyebrow: "Shop", heading: categoryName, title: categoryName };
  return { eyebrow: "Shop", heading: "Everything", title: "Browse" };
}

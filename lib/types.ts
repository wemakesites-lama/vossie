// Shapes follow the future Supabase tables (spec section 13).

export type ImageRef = {
  src: string;
  alt: string;
};

export type Campus = {
  slug: string;
  name: string;
  /** Province, or "Online, anywhere in SA" for Eduvos Online. */
  region: string;
  liveListings: number;
  image: ImageRef;
};

export type Category = {
  slug: string;
  name: string;
  image: ImageRef;
};

export type Announcement = {
  id: string;
  tag: string;
  text: string;
  href: string;
};

/** Trending search terms keyed by campus slug, plus "all" for every campus. */
export type TrendingSearches = Readonly<Record<string, readonly string[]>>;

/** "all" or a campus slug. */
export type CampusChoice = string;

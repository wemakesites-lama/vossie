/**
 * The shop plans' numbers (decision 100, Lama 2026-11-05): buyers never pay, and a shop chooses Starter (free) or
 * Plus. The Plans page (`/plans`) is the only place that shows them. Nothing is charged yet and nothing enforces these
 * limits: CampusCart takes no payments, and every shop has everything while the pilot runs. Change a number here, and
 * the page, its test and the presentation follow.
 */

/** What Plus will cost a month, in whole rand. */
export const PLUS_PRICE_ZAR = 29;

/** How many listings a Starter shop will have live at once. */
export const STARTER_LISTINGS = 5;

/** How many times a month a Starter shop will use "Fill in from my photo". */
export const STARTER_PHOTO_FILLS = 3;

/** A year of Plus, for the "one sale covers it" line. */
export const PLUS_YEAR_ZAR = PLUS_PRICE_ZAR * 12;

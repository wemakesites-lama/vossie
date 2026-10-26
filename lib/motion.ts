// The navigation types a link can carry (calm navigation spec 4, layer 3). PageTransition maps them to animations;
// links pass them as transitionTypes. Untyped navigations (Server Action redirects, browser Back) don't animate.
export const TAB = ["nav-tab"];
export const FORWARD = ["nav-forward"];
export const BACK = ["nav-back"];

/**
 * Listing and shop cards. React waits up to 500 ms for visible photos before a view transition, so Task 1 measured it
 * on slow 3G at 390 (5 runs, median): a card to its listing reached the page in 565 ms with the slide against 586 ms
 * without, and a tab to /browse in 151 ms against 124 ms. Well under the 150 ms the plan allowed, so cards slide.
 */
export const CARD = FORWARD;

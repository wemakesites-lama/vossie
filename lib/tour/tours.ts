import type { StepTarget, TourId } from "./targets";

export type TourStep = { target: StepTarget; title: string; body: string };

/** The card's heading when no step can show (spec 6.2): only if the page changed between the menu and the tap. */
export const NOTHING_HERE = "Nothing to show here right now";

/**
 * Each page's steps, in order (guided tour spec 4). A step whose part isn't on screen is skipped, so Home's role steps
 * are alternatives: only the tabs the bar is showing have parts on screen. Only the tour's own chunk imports this file:
 * its words must never reach a page's first load (spec 7.4).
 */
export const TOURS: Record<TourId, readonly TourStep[]> = {
  home: [
    {
      target: "search",
      title: "Search",
      body: "Look for anything on campus: textbooks, tech, services. A few words or a whole sentence both work.",
    },
    {
      target: ["hero-campus", "hdr-campus"],
      title: "Your campus",
      body: "We show listings from your campus first. Change it any time.",
    },
    {
      target: ["tab-shop", "hdr-shop"],
      title: "Shop",
      body: "Every listing, by category, with filters for price and campus.",
    },
    {
      target: ["tab-sell", "hdr-sell"],
      title: "Sell",
      body: "List something in a few minutes. Once you have a shop, it lives here too.",
    },
    {
      target: "tab-myshop",
      title: "My shop",
      body: "Your listings, messages from buyers and this week's next steps.",
    },
    { target: "tab-mentoring", title: "Mentoring", body: "The shops you mentor, and who's due a check-in." },
    { target: "tab-today", title: "Today", body: "What's waiting for the Hub: new shops, reports and bookings." },
    {
      target: ["tab-saved", "hdr-saved"],
      title: "Saved",
      body: "Tap the heart on any listing and it lands here, so you can come back to it.",
    },
    { target: "tab-messages", title: "Messages", body: "Talk to buyers and sellers. Meet on campus, somewhere public." },
    {
      target: ["tab-you", "hdr-account"],
      title: "You",
      body: "Notifications, your requests and your details, in one place.",
    },
    { target: "menu", title: "The menu", body: "Categories, Launchpad, Looking For, and your theme and data saver." },
  ],
  browse: [
    { target: "browse-categories", title: "Categories", body: "Jump to one kind of thing. All shows everything." },
    { target: "browse-filters", title: "Filters", body: "Narrow down by price, campus and more." },
    { target: "browse-sort", title: "Sort", body: "Best match, newest, or by price." },
    {
      target: "browse-save-search",
      title: "Save this search",
      body: "We'll tell you when something new matches, once a day at most.",
    },
  ],
  listing: [
    { target: "listing-gallery", title: "Photos", body: "Swipe through the seller's photos." },
    {
      target: "listing-seller",
      title: "The seller",
      body: "Every seller is a student business. Verified means the Hub has checked them.",
    },
    {
      target: "listing-actions",
      title: "Message, save or share",
      body: "Ask the seller a question or arrange to meet, keep it in Saved, or send it to a friend.",
    },
    { target: "listing-report", title: "Report", body: "Something wrong with this listing? Tell the Hub." },
  ],
  sell: [
    { target: "sell-needs-you", title: "Needs you", body: "Buyers waiting for a reply, and sales to mark sold." },
    { target: "sell-coach", title: "This week", body: "Up to three small steps to help your shop this week." },
    { target: "sell-add", title: "New listing", body: "Add something to sell, or answer your buyers." },
    { target: "sell-listings", title: "Your listings", body: "What's live, paused, sold and still a draft." },
    { target: "sell-bar", title: "Your shop's sections", body: "Listings, messages and your shop's profile." },
  ],
  you: [
    { target: "you-for-you", title: "For you", body: "New messages, offers and notifications." },
    { target: "you-stuff", title: "Your stuff", body: "Messages, notifications, saved things and your requests." },
    {
      target: "you-settings",
      title: "Settings",
      body: "Your details, privacy (download your data or delete your account) and signing out.",
    },
  ],
};

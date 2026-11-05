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
    {
      target: "menu",
      title: "The menu",
      body: "Shop by category, Sell, Launchpad, Looking For, and your theme and data saver.",
    },
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
  "looking-for": [
    {
      target: "lf-post",
      title: "Post a request",
      body: "Say what you need and by when. Students who can help will offer.",
    },
    { target: "lf-categories", title: "Categories", body: "Show only one kind of request." },
    {
      target: "lf-requests",
      title: "Open requests",
      body: "What students are looking for, your campus first. Open one to offer.",
    },
  ],
  hub: [
    {
      target: "hub-start",
      title: "Get started",
      body: "Book a slot with a mentor, or open your shop and start selling.",
    },
    {
      target: "hub-coach",
      title: "Your week",
      body: "Up to three small steps for your shop this week, the same as on your shop's home.",
    },
    { target: "hub-coming-up", title: "Coming up", body: "Events and office hours. Pick a tab to see just one kind." },
    { target: "hub-tips", title: "Tips", body: "Short, practical tips from the Hub for running a student business." },
    { target: "hub-verified", title: "Verified shops", body: "Student businesses the Hub has checked." },
  ],
  messages: [
    {
      target: "inbox-list",
      title: "Your conversations",
      body: "Every conversation with a buyer or seller. Open one to reply.",
    },
    { target: "inbox-tabs", title: "Buying and selling", body: "With a shop, your buyers' messages are under Selling." },
    { target: "inbox-refresh", title: "Refresh", body: "New messages show when you refresh or open the page again." },
  ],
  "listing-form": [
    { target: "form-photos", title: "Photos", body: "Up to 6 photos. The first is the cover. Ask anyone in a photo first." },
    {
      target: "form-photo-start",
      title: "Fill in from my photo",
      body: "We'll fill in what we can see from your photo. You check it before anything goes live.",
    },
    { target: "form-price", title: "Price", body: "What buyers pay, in rand." },
    { target: "form-publish", title: "Publish or save", body: "Publish when it's ready, or save a draft and finish later." },
  ],
  "admin-today": [
    {
      target: "today-waiting",
      title: "Waiting",
      body: "Everything waiting for the Hub: new shops, reports and booking requests.",
    },
    {
      target: "today-week",
      title: "Last week",
      body: "Last week's numbers. Small counts show as Hidden or Under 5, to protect students' privacy.",
    },
    { target: "today-campuses", title: "Listings by campus", body: "How many listings each campus has." },
    { target: "staff-bar", title: "The console", body: "Every section of the Hub console. On phones, the rest are under More." },
  ],
  mentor: [
    {
      target: "mentor-shops",
      title: "Your shops",
      body: "The shops you mentor, most flags first, then the longest since a check-in.",
    },
    { target: "mentor-enquiries", title: "Enquiries", body: "Each shop's enquiries over the last 14 days." },
    { target: "staff-bar", title: "Mentoring", body: "Mentoring's sections. Export downloads your caseload as a CSV file." },
  ],
};

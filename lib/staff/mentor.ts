import { badgeLabel } from "@/lib/format";
import { replyRate } from "@/lib/selling/badges";
import type { EnquiryCounts, MentorFlag, MentoredShop, SellerStatus } from "@/lib/types";

// The mentor dashboard's flags, its caseload rules and its CSV (staff tools spec 2.6, plan decisions 15 and 17; role
// views spec 7.3). Mentors see numbers, never messages (FUNCTION-MAP K1), and a check-in's day, never what was said.
// Plain functions; the words are samples for Lama to change (plan decision 22). Days come from the caller, in SAST.

/** The dashboard's window: the spec's first flag counts 14 days. */
export const MENTOR_WINDOW_DAYS = 14;
/** "Slow replies" is under half answered within 48 hours. */
export const SLOW_REPLY_RATE = 0.5;
/** A check-in is due when there's been none, or the last is more than this many days old (role views spec 7.3). */
export const CHECK_IN_DUE_DAYS = 30;

const DAY_MS = 86_400_000;

type FlagInput = {
  counts: EnquiryCounts;
  status: SellerStatus;
  pausedBy: "seller" | "staff" | null;
  /** Its listings a buyer could ask about: available, and not hidden by the Hub. */
  availableListings: number;
};

/**
 * A shop's flags, in this order (staff tools spec 2.6; role views spec 7.3). With nothing up for buyers it's "No
 * listings yet", not "No enquiries": there was nothing to ask about. Slow replies only count once an enquiry is due
 * (selling plan decision 18). A pause says whose it is; one with no record of whose is the seller's.
 */
export function mentorFlags({ counts, status, pausedBy, availableListings }: FlagInput): MentorFlag[] {
  const flags: MentorFlag[] = [];
  if (availableListings === 0) flags.push("no-listings");
  else if (counts.enquiries === 0) flags.push("no-enquiries");
  const rate = replyRate(counts);
  if (rate !== null && rate < SLOW_REPLY_RATE) flags.push("slow-replies");
  if (status === "paused") flags.push(pausedBy === "staff" ? "paused-by-hub" : "paused-by-seller");
  return flags;
}

/** Each flag's name and what it means, for the caseload's rows, the shop's mentor page and the CSV. */
export const FLAG_WORDS: Readonly<Record<MentorFlag, { label: string; explanation: string }>> = {
  "no-listings": {
    label: "No listings yet",
    explanation: "Nothing is up for buyers yet, so there's nothing to ask about. A first listing is the next step.",
  },
  "no-enquiries": {
    label: "No enquiries in 14 days",
    explanation: "No buyer has asked about a listing in the last 14 days. New listings or better photos may help.",
  },
  "slow-replies": {
    label: "Slow replies (under 50% in 48 hours)",
    explanation: "Fewer than half of the enquiries that are due were answered within 48 hours.",
  },
  "paused-by-hub": {
    label: "Paused by the Hub",
    explanation: "The Hub paused the shop, so buyers can't see it until the Hub resumes it.",
  },
  "paused-by-seller": {
    label: "Paused by the seller",
    explanation: "The seller paused the shop, so buyers can't see its listings until they resume it.",
  },
};

/** "3 of 4", or "None due yet" while no enquiry has come due (selling plan decision 18). */
export function repliesInTime(counts: EnquiryCounts): string {
  return counts.due === 0 ? "None due yet" : `${counts.repliedInTime} of ${counts.due}`;
}

const STATUS_WORDS: Readonly<Record<SellerStatus, string>> = { pending: "Waiting", approved: "Open", paused: "Paused" };

/** A shop's status as the CSV words it. */
export function statusWords(status: SellerStatus): string {
  return STATUS_WORDS[status];
}

/** A shop's status as the mentor page words it, a pause with whose it is (role views spec 7.3). */
export function shopStanding(status: SellerStatus, pausedBy: "seller" | "staff" | null): string {
  if (status !== "paused") return statusWords(status);
  return pausedBy === "staff" ? "Paused by the Hub" : "Paused by the seller";
}

/** Whole days from `day` to `today`, both YYYY-MM-DD in South Africa. */
function daysSince(day: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY_MS);
}

/** Due with no check-in yet, or more than 30 days after the last (N4 plan decision 5). */
export function checkInDue(lastOn: string | null, today: string): boolean {
  return lastOn === null || daysSince(lastOn, today) > CHECK_IN_DUE_DAYS;
}

/** The check-in chip's words: "Due", "Today", "1 day ago" or "9 days ago". */
export function checkInWords(lastOn: string | null, today: string): string {
  if (lastOn === null || checkInDue(lastOn, today)) return "Due";
  const days = daysSince(lastOn, today);
  if (days === 0) return "Today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** A shop needs you when it has a flag or its check-in is due (role views spec 7.3). */
export function needsYou(row: Pick<MentoredShop, "flags" | "lastCheckInOn">, today: string): boolean {
  return row.flags.length > 0 || checkInDue(row.lastCheckInOn, today);
}

type Ordered = Pick<MentoredShop, "flags" | "lastCheckInOn" | "name">;

/**
 * mentoredShops' order (role views spec 6): the most flags first, then the longest since a check-in (none at all
 * first), then by name. Equal ages compare as 0 before subtracting, so two shops with no check-in (Infinity) tie
 * rather than giving NaN.
 */
export function byNeed(today: string): (a: Ordered, b: Ordered) => number {
  const since = (row: Ordered) =>
    row.lastCheckInOn === null ? Number.POSITIVE_INFINITY : daysSince(row.lastCheckInOn, today);
  return (a, b) => {
    const [sinceA, sinceB] = [since(a), since(b)];
    return (
      b.flags.length - a.flags.length || (sinceB === sinceA ? 0 : sinceB - sinceA) || a.name.localeCompare(b.name)
    );
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The caseload's header line: "2 of 6 need you · 2 slot requests". The slots are left out when they couldn't be read. */
export function caseloadSummary(need: number, total: number, slotRequests: number | null): string {
  const shops = `${need} of ${total} need you`;
  return slotRequests === null ? shops : `${shops} · ${plural(slotRequests, "slot request", "slot requests")}`;
}

/** A caseload row's detail: its flags' explanations, or "No flags."; an admin's starts with the mentor's name. */
export function caseloadDetail(row: Pick<MentoredShop, "flags" | "mentorName">, showMentor: boolean): string {
  const flags = row.flags.length === 0 ? "No flags." : row.flags.map((flag) => FLAG_WORDS[flag].explanation).join(" ");
  return showMentor ? `Mentor: ${row.mentorName}. ${flags}` : flags;
}

/** The largest day across every shop's series: the small multiples' shared scale (N4 plan decision 8). */
export function sharedMax(series: Iterable<readonly (number | null)[]>): number {
  let max = 0;
  for (const points of series) for (const point of points) if (point !== null && point > max) max = point;
  return max;
}

/** A small chart's takeaway: "Tech corner: 4 enquiries in 3 days, 3 today." Days before the shop opened don't count. */
export function sparkSummary(name: string, points: readonly (number | null)[]): string {
  const known = points.filter((point): point is number => point !== null);
  if (known.length === 0) return `${name}: no days to show yet.`;
  const total = known.reduce((sum, point) => sum + point, 0);
  const last = points[points.length - 1];
  const today = last === null || last === undefined ? "" : `, ${last} today`;
  return `${name}: ${plural(total, "enquiry", "enquiries")} in ${plural(known.length, "day", "days")}${today}.`;
}

/**
 * One CSV cell (RFC 4180). Text always goes in double quotes, with any quotes inside doubled, so a separator that isn't
 * a comma can't split it: where Excel's list separator is a semicolon, an unquoted `Bakes;=1+1;` would become three
 * cells, the second a formula. Text that starts with =, +, -, @, a tab or a carriage return gets an apostrophe first,
 * so a spreadsheet never runs a shop's name as a formula (plan decision 17, amendment 12.1). Numbers go in bare.
 */
export function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

/** A UTF-8 byte-order mark: without it Excel reads the file as ANSI and garbles "Zoë's Café" (amendment 12.2). */
const BYTE_ORDER_MARK = "\uFEFF";

const CSV_HEADER = [
  "Shop",
  "Campus",
  "Mentor",
  "Badge",
  "Status",
  "Enquiries (14 days)",
  "Due for a reply",
  "Replied within 48 hours",
  "Sales confirmed (14 days)",
  "Flags",
];

/**
 * The dashboard's shops as a CSV file (spec 2.6), one line per shop in the dashboard's order, each ending in CRLF. No
 * messages, no emails, no check-ins. It starts with a byte-order mark, so the route sends the body as it is
 * (amendment 12.2).
 */
export function mentorCsv(rows: readonly MentoredShop[], campusNames: ReadonlyMap<string, string>): string {
  const lines = [
    CSV_HEADER,
    ...rows.map((row) => [
      row.name,
      campusNames.get(row.campusSlug) ?? row.campusSlug,
      row.mentorName,
      row.badge ? badgeLabel(row.badge) : "",
      statusWords(row.status),
      row.counts.enquiries,
      row.counts.due,
      row.counts.repliedInTime,
      row.counts.salesConfirmed,
      row.flags.map((flag) => FLAG_WORDS[flag].label).join("; "),
    ]),
  ];
  return BYTE_ORDER_MARK + lines.map((cells) => `${cells.map(csvCell).join(",")}\r\n`).join("");
}

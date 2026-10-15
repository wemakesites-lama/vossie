import { badgeLabel, joinWords } from "@/lib/format";
import { DAY_MS } from "@/lib/messaging/rules";
import type { EnquiryCounts, TrustBadge } from "@/lib/types";

// The trust page's badge rules (part C's /trust; FUNCTION-MAP section 6) and what the next badge still needs
// (selling spec 2.8, plan decision 18). Stage G works the badges out; this only explains the next step.

const RULES = {
  responsive: { enquiries: 3, rate: 0.8, sales: 0, days: 0 },
  trusted: { enquiries: 3, rate: 0.85, sales: 5, days: 30 },
} as const;

/** The share of due enquiries answered within 48 hours, or null while none is due. */
export function replyRate(counts: Pick<EnquiryCounts, "due" | "repliedInTime">): number | null {
  return counts.due === 0 ? null : counts.repliedInTime / counts.due;
}

const more = (n: number, one: string, many: string) => `${n} more ${n === 1 ? one : many}`;

/**
 * What the badge above `current` still needs, as one sentence: "1 more enquiry and 5 more confirmed sales for
 * Trusted." `record` is the last 90 days' enquiries and every confirmed sale; `accountCreatedAt` is the owner's.
 */
export function badgeProgress(
  current: TrustBadge | null,
  record: EnquiryCounts,
  accountCreatedAt: string,
  now: Date,
): string {
  if (current === "trusted") return "Trusted is the highest badge. Keep replying quickly to keep it.";
  const next = current === "responsive" ? "trusted" : "responsive";
  const rule = RULES[next];
  const needs: string[] = [];
  if (record.enquiries < rule.enquiries) needs.push(more(rule.enquiries - record.enquiries, "enquiry", "enquiries"));
  const rate = replyRate(record);
  // With no enquiry due yet the rate isn't known: it's only asked for once there are enough enquiries.
  if (rate !== null ? rate < rule.rate : record.enquiries >= rule.enquiries) {
    const rateNow = rate === null ? "" : ` (now ${Math.round(rate * 100)}%)`;
    needs.push(`${Math.round(rule.rate * 100)}% of enquiries answered within 48 hours${rateNow}`);
  }
  if (record.salesConfirmed < rule.sales) {
    needs.push(more(rule.sales - record.salesConfirmed, "confirmed sale", "confirmed sales"));
  }
  const days = Math.floor((now.getTime() - Date.parse(accountCreatedAt)) / DAY_MS);
  if (days < rule.days) needs.push(more(rule.days - days, "day on Vossie", "days on Vossie"));
  const label = badgeLabel(next);
  if (needs.length === 0) return `You meet the rules for ${label}. Your badge changes when the Hub next updates badges.`;
  const sentence = `${joinWords(needs)} for ${label}.`;
  return sentence[0].toUpperCase() + sentence.slice(1);
}

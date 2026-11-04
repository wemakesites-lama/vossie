import "server-only";
import { aiFeatureOn } from "@/lib/ai/config";
import { getListingDetail, getRequest, getSeller } from "@/lib/data";
import { readReport, type ReportForRead } from "@/lib/data/ai";
import { photoFor, photoIdOf } from "@/lib/data/photos";
import { reportForRead, saveFirstRead, type ReportToRead } from "@/lib/data/reports";

// A read of each report (AI features spec section 4, stage C): made after a student files one (sendReport's after())
// and by Read again (readReportAgain). Never throws: everything is caught and only the kind logged, never the report.

export type FirstReadResult = "saved" | "skipped" | "failed" | "off";

/**
 * Whether Read again shows and runs (planning decision 4): the switch on, an open student's report with no read, not
 * the admin's own, and a target the public readers still give (there, and not hidden; a paused one still reads). The
 * page and readReportAgain both ask this, so the button never offers a read that can't be made.
 */
export function canReadAgain(view: {
  open: boolean;
  own: unknown;
  reporterId: string | null;
  firstRead: unknown;
  exists: boolean;
  unseen: "hidden" | "paused" | null;
}): boolean {
  return (
    aiFeatureOn("report-read") &&
    view.open &&
    view.own === null &&
    view.reporterId !== null &&
    !view.firstRead &&
    view.exists &&
    view.unseen !== "hidden"
  );
}

/**
 * The reported thing's own words and a listing's uploaded cover (planning decision 5), from the public readers, so a
 * target that's gone or hidden gives null. A stock or placeholder cover is left out.
 */
async function inputFor(report: ReportToRead, now: Date): Promise<ReportForRead | null> {
  const base = { reason: report.reason, detail: report.detail };
  switch (report.target.kind) {
    case "listing": {
      const found = await getListingDetail(report.target.id);
      if (!found) return null;
      const id = photoIdOf(found.listing.image.src);
      const photo = id ? await photoFor(id, async () => null, now).catch(() => null) : null;
      return {
        ...base,
        kind: "listing",
        title: found.listing.title,
        words: found.listing.description,
        categoryName: found.category.name,
        cover: photo ? { type: photo.type, bytes: photo.bytes } : null,
      };
    }
    case "seller": {
      const shop = await getSeller(report.target.id);
      return shop
        ? { ...base, kind: "seller", title: shop.name, words: shop.about, categoryName: shop.category, cover: null }
        : null;
    }
    case "request": {
      const request = await getRequest(report.target.id);
      return request
        ? { ...base, kind: "request", title: request.title, words: request.details, categoryName: null, cover: null }
        : null;
    }
  }
}

/**
 * Makes and stores a student's report's first read: "saved", "skipped" (none to read: not a student's, closed, about
 * something gone, or read already), "failed" (the target can't be read or the model gave nothing) or "off".
 */
export async function makeFirstRead(reportId: string, now: Date): Promise<FirstReadResult> {
  if (!aiFeatureOn("report-read")) return "off";
  try {
    const report = await reportForRead(reportId);
    if (!report || report.read || !report.open || report.gone) return "skipped";
    const input = await inputFor(report, now);
    if (!input) return "failed";
    const read = await readReport(input);
    if (!read) return "failed";
    return (await saveFirstRead(reportId, read)) === "saved" ? "saved" : "skipped";
  } catch {
    console.warn("[vossie] report-read: make error");
    return "failed";
  }
}

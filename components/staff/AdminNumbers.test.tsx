import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MEASURES,
  protectCounts,
  sastWeeks,
  type Measure,
  type Period,
  type RawColumn,
  type RawCounts,
} from "@/lib/staff/numbers";
import { AdminNumbers } from "./AdminNumbers";

const CAMPUSES = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];
const SLUGS = CAMPUSES.map((campus) => campus.slug);
const WEEKS = sastWeeks(new Date("2026-10-20T08:00:00.000Z"));

const column = (campuses: Record<string, number> = {}, gone = 0): RawColumn => ({ campuses, gone });

function shown() {
  const counts = Object.fromEntries(
    MEASURES.map(({ measure }) => [measure, { last: column(), before: column(), since: column() }]),
  ) as Record<Measure, Record<Period, RawColumn>>;
  counts.listings = { last: column({ midrand: 6, pretoria: 2 }), before: column({ midrand: 4 }), since: column({ midrand: 40, pretoria: 9 }) };
  counts.enquiries = { last: column({ midrand: 3, pretoria: 12 }), before: column({ midrand: 8 }), since: column({ midrand: 23 }) };
  const raw: RawCounts = { counts, openShops: column({ midrand: 5, pretoria: 2 }) };
  return protectCounts(raw, SLUGS);
}

/** A row's cells as the values shown, without each cell's hidden column label (the first cell is a row header or link). */
function values(row: HTMLElement | null) {
  return within(row!)
    .getAllByRole("cell")
    .map((cell) => {
      const label = cell.querySelector(".staff-cell-label")?.textContent ?? "";
      return (cell.textContent ?? "").slice(label.length);
    });
}

function view(campus: (typeof CAMPUSES)[number] | null = null, sampleMode = true) {
  return render(<AdminNumbers weeks={WEEKS} shown={shown()} campuses={CAMPUSES} campus={campus} sampleMode={sampleMode} />);
}

describe("the admin's numbers (stage J spec decisions 10 to 13)", () => {
  it("says how it counts, and that the preview's store starts again on restart", () => {
    view();
    expect(screen.getByText(/^Counted from Vossie's store as this page opens\./)).toHaveTextContent(
      'Small numbers of private things show as "Under 5" or "Hidden", so no one can be picked out.',
    );
    expect(screen.getByText("In this preview the store starts again whenever the server restarts.")).toBeInTheDocument();
  });

  it("leaves the preview line out outside sample mode", () => {
    view(null, false);
    expect(screen.queryByText(/In this preview/)).toBeNull();
  });

  it("has an All campuses table by week, each measure a row header, with Open shops now not counted by week", () => {
    view();
    const table = screen.getByRole("table", { name: "All campuses, by week" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Measure",
      "Last week (12 to 18 Oct)",
      "The week before (5 to 11 Oct)",
      "Change",
      "Since the start",
    ]);
    const listings = within(table).getByRole("rowheader", { name: "Listings published" });
    expect(listings).toHaveAttribute("scope", "row");
    expect(values(listings.closest("tr"))).toEqual(["8", "4", "+4", "49"]);
    // Enquiries are private: the week before's total is 8, so last week's change shows; since the start is in tens.
    expect(values(within(table).getByRole("rowheader", { name: "Enquiries started" }).closest("tr"))).toEqual([
      "15",
      "8",
      "+7",
      "20+",
    ]);
    const open = within(table).getByRole("rowheader", { name: "Open shops now" }).closest("tr");
    expect(values(open)).toEqual(["Not counted by week", "Not counted by week", "Not counted by week", "7"]);
  });

  it("has a By campus table for last week, each campus a 44px link to its view, then All campuses", () => {
    view();
    const table = screen.getByRole("table", { name: "By campus, last week (12 to 18 Oct)" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Campus",
      ...MEASURES.map((measure) => measure.label),
      "Open shops now",
    ]);
    const midrand = within(table).getByRole("link", { name: "Midrand" });
    expect(midrand).toHaveAttribute("href", "/admin/numbers?campus=midrand");
    expect(midrand).toHaveClass("min-h-11");
    // Columns: the seven measures, then Open shops now. Midrand had 3 enquiries, so last week's enquiries aren't shown
    // by campus at all (Pretoria's 12 too). Listings are last week's (6 and 2), not since the start (40 and 9).
    expect(values(midrand.closest("tr"))).toEqual(["6", "0", "0", "Hidden", "0", "0", "0", "5"]);
    expect(values(within(table).getByRole("link", { name: "Pretoria" }).closest("tr"))).toEqual([
      "2", "0", "0", "Hidden", "0", "0", "0", "2",
    ]);
    expect(values(within(table).getByRole("rowheader", { name: "All campuses" }).closest("tr"))).toEqual([
      "8", "0", "0", "15", "0", "0", "0", "7",
    ]);
    expect(within(table).getAllByRole("link").map((link) => link.textContent)).toEqual(["Midrand", "Pretoria"]);
    const section = table.closest("section")!;
    expect(within(section).getByText(/^Under 5: a private total from 1 to 4\.$/)).toBeInTheDocument();
    expect(within(section).getByText(/^Hidden: not shown by campus/)).toBeInTheDocument();
  });

  it("explains every word under each table, and names, ids or links nothing counted", () => {
    const { container } = view();
    expect(screen.getAllByText(
        "Hidden: not shown by campus, because a campus had from 1 to 4 that week (or 1 to 9 since the start), so no one can be picked out.",
      )).toHaveLength(2);
    expect(screen.getAllByText("Under 5: a private total from 1 to 4.")).toHaveLength(2);
    expect(screen.getAllByText(/Admins can still open each report in the Reports queue/)).toHaveLength(2);
    const links = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(links.every((href) => href?.startsWith("/admin/numbers?campus="))).toBe(true);
  });

  it("shows one campus's view, captioned with its name, with a link back to All campuses", () => {
    view(CAMPUSES[0]);
    const table = screen.getByRole("table", { name: "Midrand, by week" });
    expect(values(within(table).getByRole("rowheader", { name: "Listings published" }).closest("tr"))).toEqual([
      "6",
      "4",
      "+2",
      "40",
    ]);
    expect(values(within(table).getByRole("rowheader", { name: "Enquiries started" }).closest("tr"))).toEqual([
      "Hidden",
      "8",
      "—",
      "Hidden",
    ]);
    expect(values(within(table).getByRole("rowheader", { name: "Open shops now" }).closest("tr"))).toEqual([
      "Not counted by week",
      "Not counted by week",
      "Not counted by week",
      "5",
    ]);
    // The campus view has its own key, with the Hidden and Under 5 lines.
    expect(screen.getByText("Under 5: a private total from 1 to 4.")).toBeInTheDocument();
    expect(screen.getAllByText(/^Hidden: not shown by campus/)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "All campuses" })).toHaveAttribute("href", "/admin/numbers");
    expect(screen.queryByRole("table", { name: /^By campus/ })).toBeNull();
  });
});

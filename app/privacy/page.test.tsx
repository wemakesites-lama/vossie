import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, SIGN_IN_COOKIE } from "@/lib/auth/cookies";
import { CAMPUS_COOKIE } from "@/lib/campus";
import { FLASH_COOKIE } from "@/lib/flash";
import { LOW_DATA_KEY } from "@/lib/low-data";
import { RECENT_KEY } from "@/lib/recent-searches";
import { RECENTLY_VIEWED_KEY } from "@/lib/recently-viewed";
import { SAVED_COOKIE } from "@/lib/saved";
import PrivacyPage, { metadata } from "./page";

/** The `code` words in the first list after a heading. */
function codesAfter(heading: HTMLElement): string[] {
  let node = heading.nextElementSibling;
  while (node && node.tagName !== "UL") node = node.nextElementSibling;
  return [...(node?.querySelectorAll("code") ?? [])].map((code) => code.textContent ?? "");
}

describe("Privacy policy (info and system spec 2.1, 2.2 and 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("Privacy policy");
    expect(metadata.description).toMatch(/POPIA/);
  });

  it("is kept out of search results until Eduvos signs it off (controller amendment 1)", () => {
    expect(metadata.robots).toEqual({ index: false });
  });

  it("has one h1 and nine sections", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Who is responsible",
      "What this site stores today",
      "Your account",
      "How long we keep it",
      "Who it is shared with",
      "Where it is hosted",
      "Your rights",
      "Contact the Hub",
      "Changes to this policy",
    ]);
  });

  it("is a draft, in words (spec 2.1)", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("note")).toHaveTextContent("Draft for Eduvos to review. Not yet in force.");
  });

  it("says the Information Officer is to be named by Eduvos, and names no one", () => {
    render(<PrivacyPage />);
    const who = screen.getByRole("region", { name: "Who is responsible" });
    expect(within(who).getByText(/to be named by Eduvos/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Contact the Hub" })).getByText(/to be named by Eduvos/)).toBeInTheDocument();
    expect(within(who).getByText(/Eduvos is the responsible party/)).toBeInTheDocument();
  });

  it("lists the two cookies and the three browser-only stores by their real names (spec 2.2)", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(within(today).getByText(/in its memory only/)).toBeInTheDocument();
    expect(codesAfter(within(today).getByRole("heading", { level: 3, name: "Two first-party cookies" }))).toEqual([
      CAMPUS_COOKIE,
      SAVED_COOKIE,
    ]);
    expect(
      codesAfter(within(today).getByRole("heading", { level: 3, name: "Three things kept only in your browser" })),
    ).toEqual([RECENTLY_VIEWED_KEY, RECENT_KEY, LOW_DATA_KEY]);
  });

  it("names the three sign-in cookies by their real names (accounts spec 2.2, 2.5 and plan decision 12)", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(codesAfter(within(today).getByRole("heading", { level: 3, name: "Three sign-in cookies" }))).toEqual([
      SESSION_COOKIE,
      SIGN_IN_COOKIE,
      FLASH_COOKIE,
    ]);
  });

  it("says plainly that the saved ids travel to Vossie with each visit, and that nothing is stored on a server", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    const saved = within(today).getByText(/Your browser sends the listing ids to Vossie with each visit/);
    expect(saved.tagName).toBe("LI");
    expect(saved.textContent).toBe(
      `Your saved listings, in a cookie called ${SAVED_COOKIE} that lasts up to a year. ` +
        "Your browser sends the listing ids to Vossie with each visit so the Saved page can show them; " +
        "nothing is stored on a server.",
    );
  });

  it("says what else happens: searches in the address, server logs, the unsent sign-up, no tracking", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(within(today).getByText(/\/browse\?q=calculator/)).toBeInTheDocument();
    expect(within(today).getByText(/ordinary server logs/)).toBeInTheDocument();
    expect(within(today).getByText(/doesn't send or store your email address yet/)).toBeInTheDocument();
    expect(within(today).getByText(/no advertising or tracking cookies, and no analytics/)).toBeInTheDocument();
    expect(within(today).getByText(/clear cookies like these after a week/)).toBeInTheDocument();
  });

  it("lists what accounts will collect, why and the POPIA section 11 ground, so it needn't be rewritten", () => {
    render(<PrivacyPage />);
    const accounts = screen.getByRole("region", { name: "Your account" });
    const items = within(accounts).getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(8);
    expect(within(accounts).getByText("Your Eduvos email address.")).toBeInTheDocument();
    expect(within(accounts).getByText("Your first name and campus.")).toBeInTheDocument();
    expect(within(accounts).getByText("Your agreement to this policy.")).toBeInTheDocument();
    expect(within(accounts).getAllByText(/Allowed under POPIA section 11/).length).toBe(items.length);
  });

  it("says nobody is sold anything, and who sees what", () => {
    render(<PrivacyPage />);
    const sharing = screen.getByRole("region", { name: "Who it is shared with" });
    expect(within(sharing).getByText(/does not sell personal information to anyone/)).toBeInTheDocument();
    expect(within(sharing).getByText(/say "a student", never a name/)).toBeInTheDocument();
  });

  it("says where it is hosted is still to be decided, with the section 72 safeguards", () => {
    render(<PrivacyPage />);
    const hosting = screen.getByRole("region", { name: "Where it is hosted" });
    expect(within(hosting).getByText(/still to be decided/)).toBeInTheDocument();
    expect(within(hosting).getByText(/POPIA section 72/)).toBeInTheDocument();
  });

  it("lists the rights and points to the Information Regulator", () => {
    render(<PrivacyPage />);
    const rights = screen.getByRole("region", { name: "Your rights" });
    expect(within(rights).getAllByRole("listitem")).toHaveLength(6);
    expect(within(rights).getByRole("link", { name: "inforegulator.org.za" })).toHaveAttribute(
      "href",
      "https://inforegulator.org.za",
    );
  });

  it("sends you to your privacy settings to download your data or delete your account (accounts spec 3.3)", () => {
    render(<PrivacyPage />);
    const rights = screen.getByRole("region", { name: "Your rights" });
    expect(within(rights).getByRole("link", { name: "privacy settings" })).toHaveAttribute("href", "/account/privacy");
  });

  it("names every vossie_ cookie and browser store the code uses, so a new one can't slip past the policy", () => {
    // Every cookie and storage key is named "vossie_…". A key added later fails here until this page names it.
    const names = new Set<string>();
    for (const folder of ["app", "components", "hooks", "lib"]) {
      for (const file of readdirSync(join(process.cwd(), folder), { recursive: true }) as string[]) {
        if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
        const source = readFileSync(join(process.cwd(), folder, file), "utf8");
        for (const [, name] of source.matchAll(/"(vossie_[a-z_]+)"/g)) names.add(name);
      }
    }
    expect(names.size).toBeGreaterThanOrEqual(5);
    const { container } = render(<PrivacyPage />);
    for (const name of names) expect(container.textContent, name).toContain(name);
  });
});

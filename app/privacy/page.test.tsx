import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AUTH_COOKIE } from "@/lib/auth/cookie-names";
import { SESSION_COOKIE, SIGN_IN_COOKIE } from "@/lib/auth/cookies";
import { CAMPUS_COOKIE } from "@/lib/campus";
import { FLASH_COOKIE } from "@/lib/flash";
import { LOW_DATA_KEY } from "@/lib/low-data";
import { OFFLINE_CACHE } from "@/lib/offline";
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

  it("says Hub admins see weekly counts, never who, and that the staff log records roles (stage J spec section 6)", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("region", { name: "Who it is shared with" })).toHaveTextContent(
      "Hub admins see weekly counts for each campus (listings, shops, requests, enquiries, reports and follows), never who; small numbers are hidden so no one can be picked out.",
    );
    expect(screen.getByRole("region", { name: "Your account" })).toHaveTextContent(
      "Who approved, declined, verified, hid or paused what, when and why, and who was given or lost a staff role, so staff actions can be checked.",
    );
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

  it("lists the two cookies and the four browser-only stores by their real names (spec 2.2)", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(within(today).getByText(/in its memory only/)).toBeInTheDocument();
    expect(codesAfter(within(today).getByRole("heading", { level: 3, name: "Two first-party cookies" }))).toEqual([
      CAMPUS_COOKIE,
      SAVED_COOKIE,
    ]);
    expect(
      codesAfter(within(today).getByRole("heading", { level: 3, name: "Four things kept only in your browser" })),
    ).toEqual([RECENTLY_VIEWED_KEY, RECENT_KEY, LOW_DATA_KEY, OFFLINE_CACHE]);
  });

  it("names the four sign-in cookies by their real names (accounts spec 2.2 and 2.5; Supabase phase B, Task 9)", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(codesAfter(within(today).getByRole("heading", { level: 3, name: "Sign-in cookies" }))).toEqual([
      AUTH_COOKIE,
      `${AUTH_COOKIE}.0`,
      `${AUTH_COOKIE}.1`,
      SESSION_COOKIE,
      SIGN_IN_COOKIE,
      FLASH_COOKIE,
    ]);
    expect(today).toHaveTextContent(
      "It lasts 30 days from your last visit, so it ends if you don't use CampusCart for 30 days. Signing out or deleting your account ends it.",
    );
  });

  it("says plainly that the saved ids travel to CampusCart with each visit, and that nothing is stored on a server", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    const saved = within(today).getByText(/Your browser sends the listing ids to CampusCart with each visit/);
    expect(saved.tagName).toBe("LI");
    expect(saved.textContent).toBe(
      `Your saved listings, in a cookie called ${SAVED_COOKIE} that lasts up to a year. ` +
        "Your browser sends the listing ids to CampusCart with each visit so the Saved page can show them and your " +
        "You page can count them; nothing is stored on a server.",
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

  it("says what the staff tools keep, who sees it and what deleting does (staff tools plan decisions 6, 13 and 16)", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(within(account).getByText("Your RSVPs and slot requests.")).toBeInTheDocument();
    expect(account).toHaveTextContent(/they aren't in your data download, but you can ask the Information Officer for them/);
    expect(account).toHaveTextContent(/Nobody can edit it\. If you delete your account, entries about you lose your name/);
    expect(screen.getByRole("region", { name: "How long we keep it" })).toHaveTextContent(/RSVPs and slot requests/);
    expect(screen.getByRole("region", { name: "Who it is shared with" })).toHaveTextContent(/never your messages/);
  });

  it("says the Hub assigns the mentor, and no longer calls notes a plan for a programme (plan decision 16)", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(within(account).getByText("If the Hub mentors your shop: mentors' notes.")).toBeInTheDocument();
    expect(account).toHaveTextContent(/Mentors and Hub admins can see them; you can't/);
    expect(account).toHaveTextContent(/They are deleted with your account/);
    expect(account).not.toHaveTextContent("If you are in the Hub's programme");
    expect(account).toHaveTextContent(/Who approved, declined, verified, hid or paused what, when and why/);
    expect(account).toHaveTextContent(/entries about you lose your name and the reason/);
  });

  it("lists RSVPs and slot requests among what the preview keeps in memory, outside the 'if you sell' part", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(
      within(today).getByText(
        /your RSVPs and slot requests, your messages, your reports, your notifications and, if you sell, .* in its memory only/,
      ),
    ).toBeInTheDocument();
  });

  it("says deleting an account removes its RSVPs, slot requests and notes about its shop, and what the log keeps", () => {
    render(<PrivacyPage />);
    const keep = screen.getByRole("region", { name: "How long we keep it" });
    expect(keep).toHaveTextContent(/your RSVPs and slot requests, your messages, your reports and your notifications straight away/);
    // Notes are about a shop, so they go with the shop's part of the list.
    expect(keep).toHaveTextContent(/any shop answers you had not sent and mentors' notes about your shop, if you sell/);
    expect(keep).toHaveTextContent(/The log of what Hub staff do keeps its entries, without your name\./);
    const sharing = screen.getByRole("region", { name: "Who it is shared with" });
    expect(sharing).toHaveTextContent(/RSVPs and slot requests/);
    expect(sharing).toHaveTextContent(/A mentor sees your shop's numbers, never your messages\./);
  });

  it("says where it is hosted: Supabase in Ireland, Vercel in Dublin, Resend in the United States, under section 72", () => {
    const { container } = render(<PrivacyPage />);
    const hosting = screen.getByRole("region", { name: "Where it is hosted" });
    expect(hosting).toHaveTextContent(/stored by Supabase in Ireland/);
    expect(hosting).toHaveTextContent(/served by Vercel, whose servers that handle your requests are in Dublin/);
    expect(hosting).toHaveTextContent(
      /Sign-in codes are emailed by Resend, in the United States, which keeps your email address and the email in its logs for its retention period/,
    );
    expect(hosting).toHaveTextContent(/POPIA section 72/);
    // Nothing on the page says the hosting or the providers are still to be chosen.
    expect(container.textContent).not.toMatch(/still to be (decided|chosen)|once it is chosen/);
  });

  it("says Supabase Auth keeps security records of sign-ins for 30 days, gone within a day of a deletion (amendment 17, review fix 1)", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(account).toHaveTextContent(
      "Supabase Auth keeps security records of your sign-ins (the IP address and browser) for 30 days, and they go within a day of your account being deleted.",
    );
    expect(account).not.toHaveTextContent(/security records[^.]*limited time/);
    expect(screen.getByRole("region", { name: "How long we keep it" })).toHaveTextContent(
      "Supabase's records of sign-ins in CampusCart's database are kept for 30 days, and go within a day of an account's deletion.",
    );
    expect(screen.getByRole("region", { name: "Who it is shared with" })).toHaveTextContent(
      "Supabase (the database and sign-in), Vercel (hosting) and Resend (sign-in emails)",
    );
  });

  it("says one network's sign-in codes are counted under a fingerprint of its IP address, for about an hour (review fix 2)", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("region", { name: "Your account" })).toHaveTextContent(
      "To stop one network sending too many sign-in emails, the live site counts the codes sent from each IP address for about an hour, keeping only a fingerprint of the address made with a secret key.",
    );
  });

  it("says what is kept in memory on the preview, and in Supabase's database on the live site", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("region", { name: "What this site stores today" })).toHaveTextContent(
      "On the live site, all of this is kept in Supabase's database until you delete it or Eduvos's retention periods remove it, and the sign-in code is emailed to you.",
    );
    expect(screen.getByRole("region", { name: "How long we keep it" })).toHaveTextContent(
      "On the live site, they're kept in Supabase's database until you delete them or Eduvos's retention periods remove them.",
    );
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

  it("says what messaging keeps, for how long, and what deleting your account removes (messaging plan, Task 14)", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(within(today).getByText(/your messages, your reports, your notifications and, if you sell, .* in its memory only/)).toBeInTheDocument();
    const account = screen.getByRole("region", { name: "Your account" });
    expect(within(account).getByText("Your notifications.")).toBeInTheDocument();
    const keep = screen.getByRole("region", { name: "How long we keep it" });
    expect(within(keep).getByText(/Eduvos will set how long they are kept before launch/)).toBeInTheDocument();
    expect(within(keep).getByText(/your messages, your reports and your notifications straight away/)).toBeInTheDocument();
    // The other side keeps its own messages and sees "Deleted account" (messaging plan, amendment 3.9).
    expect(within(keep).getByText(/keeps only their own messages, and your name shows as "Deleted account"/)).toBeInTheDocument();
    expect(within(keep).queryByText(/before messaging opens/)).toBeNull();
  });

  it("says what selling keeps, what happens to a photo's hidden data, and what deleting removes (selling plan, Task 15)", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(within(today).getByText(/your shop, your listings and their photos in its memory only/)).toBeInTheDocument();
    // Photos are kept by the device that loaded them, and a deleted one can stay there (amendment 9.4).
    expect(within(today).getByText(/a copy can stay on a device that already loaded it/)).toBeInTheDocument();
    const account = screen.getByRole("region", { name: "Your account" });
    expect(within(account).getByText(/hidden data such as your location is removed from every photo/)).toBeInTheDocument();
    // What stays is only what the picture needs (amendment 8; selling spec 8.4).
    expect(within(account).getByText(/only what a photo needs to show properly/)).toBeInTheDocument();
    // The wizard's draft is held, and goes with the account (amendment 9.6).
    expect(within(account).getByText(/kept as a draft until you send your application/)).toBeInTheDocument();
    expect(within(account).queryByText(/once it opens/)).toBeNull();
    const keep = screen.getByRole("region", { name: "How long we keep it" });
    expect(within(keep).getByText(/every photo you uploaded/)).toBeInTheDocument();
    expect(within(keep).getByText(/any shop answers you had not sent/)).toBeInTheDocument();
    expect(within(keep).getByText(/shops, listings and photos live in the server/)).toBeInTheDocument();
  });

  it("says what Looking For and following keep, and that deleting your account removes them (community actions spec 2.23)", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(within(account).getByText("Your Looking For requests.")).toBeInTheDocument();
    expect(within(account).getByText("The shops you follow.")).toBeInTheDocument();
    expect(within(account).getByText(/never with your name/)).toBeInTheDocument();
    expect(within(account).getByText(/a shop sees only how many people follow it, never who/)).toBeInTheDocument();
    const keep = screen.getByRole("region", { name: "How long we keep it" });
    expect(within(keep).getByText(/your Looking For requests, the shops you follow/)).toBeInTheDocument();
  });

  it("lists requests and follows among what the preview keeps in memory, and what goes when it restarts (community actions amendment 12)", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(
      within(today).getByText(/your Looking For requests and the shops you follow, your saved searches, your RSVPs and slot requests, .* in its memory only/),
    ).toBeInTheDocument();
    const keep = screen.getByRole("region", { name: "How long we keep it" });
    expect(
      within(keep).getByText(/While CampusCart is a preview, Looking For requests, follows, saved searches, messages, reports, notifications, shops, listings and photos live in the server/),
    ).toBeInTheDocument();
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

  it("names vossie_auth, now that sign-in reaches the modules that set it (Supabase phase B, Task 9)", () => {
    // Phase A let vossie_auth go unnamed while nothing outside lib/supabase reached Supabase, and C0 and phase B's
    // Tasks 4 and 5 narrowed that guard. Phase B's sign-in sets the cookie, so the page names it and no name is exempt:
    // the test above checks every vossie_ name in the code, with no exceptions.
    const importers: string[] = [];
    for (const file of appSourceFiles()) {
      if (file.startsWith(`${SUPABASE_DIR}/`)) continue;
      if (supabaseImports(readFileSync(file, "utf8"), file).length > 0) importers.push(file.slice(process.cwd().length + 1));
    }
    expect(importers.length).toBeGreaterThan(0);
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toContain(AUTH_COOKIE);
  });

  it("finds every way of reaching lib/supabase or Supabase's packages, relative paths included", () => {
    const from = join(process.cwd(), "app", "account", "actions.ts");
    expect(supabaseImports(`import { viewerClient } from "@/lib/supabase/viewer";`, from)).toHaveLength(1);
    expect(supabaseImports(`import { authClient } from "../../lib/supabase/auth";`, from)).toHaveLength(1);
    expect(supabaseImports(`export { adminClient } from '../../lib/supabase';`, from)).toHaveLength(1);
    expect(supabaseImports(`const m = await import("../../lib/supabase/admin");`, from)).toHaveLength(1);
    expect(supabaseImports(`import "@/lib/supabase/cookies";`, from)).toHaveLength(1);
    expect(supabaseImports(`import type { Database } from\n  "@/lib/supabase/database.types";`, from)).toHaveLength(1);
    expect(supabaseImports(`import { createServerClient } from "@supabase/ssr";`, from)).toHaveLength(1);
    expect(supabaseImports(`import { x } from "../../lib/supabase-notes";`, from)).toEqual([]);
    expect(supabaseImports(`import { x } from "@/lib/data";`, from)).toEqual([]);
    // From inside lib, "./supabase/auth" is lib/supabase.
    expect(supabaseImports(`import { authClient } from "./supabase/auth";`, join(process.cwd(), "lib", "x.ts"))).toHaveLength(1);
  });

  it("says what saved searches keep, that only you see them, and that deleting your account removes them (search alerts spec 2.15)", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(within(account).getByText("Your saved searches.")).toBeInTheDocument();
    expect(within(account).getByText(/Only you see them: shops never learn/)).toBeInTheDocument();
    expect(within(account).getByText(/used only to tell you about new listings/)).toBeInTheDocument();
    const keep = screen.getByRole("region", { name: "How long we keep it" });
    expect(within(keep).getByText(/the shops you follow, your saved searches/)).toBeInTheDocument();
  });
});

describe("what stages H to K changed in the policy (stage K spec 6)", () => {
  it("opens Your account with everything that needs one, never the old \"Messaging, selling and, later\"", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(account).toHaveTextContent(
      "You need an account to message, sell, report, post on Looking For, follow shops, save searches and RSVP to the Hub.",
    );
    expect(account).not.toHaveTextContent("Messaging, selling and, later");
  });

  it("says a code and the session are kept only as keyed fingerprints", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("region", { name: "Your account" })).toHaveTextContent(
      "A sign-in code is kept only as a fingerprint made with a secret key, and only until you finish signing in or the attempt runs out after 30 minutes.",
    );
    expect(screen.getByRole("region", { name: "What this site stores today" })).toHaveTextContent(
      "CampusCart's server keeps only a fingerprint of it, made with a secret key, so the code can't be read back from the server's records.",
    );
  });

  it("says that in this preview the code shows on screen, so it is also kept as written until the attempt ends", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("region", { name: "Your account" })).toHaveTextContent(
      "In this preview the code shows on screen instead of being emailed, so until the attempt ends it's also kept as written.",
    );
  });

  it("names the slot notifications: a mentor's answer to your request, and a request at your office hours", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(account).toHaveTextContent(/a mentor answers your slot request/);
    expect(account).toHaveTextContent(/someone asks for a slot at your office hours/);
  });

  it("lists every kind of notification, and what a staff role keeps", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(account).toHaveTextContent(/a search you saved has a new match, the Hub acts on your report/);
    expect(account).toHaveTextContent(/your staff role changes, or an admin asks you to mentor a shop\. Only you see them\./);
    expect(within(account).getByText(/If you're Hub staff: your role\./)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "What this site stores today" })).toHaveTextContent(
      "your consent, your staff role if you have one, your Looking For requests",
    );
  });

  it("says requests close themselves, that you're reminded and told, and that you can reopen one (stages L and M)", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(account).toHaveTextContent(/the Hub acts on your report, your shop, your listing or your request, your request is about to close automatically, or does, a mentor answers/);
    expect(account).toHaveTextContent(
      "An open request closes automatically 3 days after its needed-by date, or after 30 days with no changes; you're reminded 2 days before and told when it does, and you can reopen it.",
    );
  });
});

const SUPABASE_DIR = join(process.cwd(), "lib", "supabase");

/** The app's own source files: app, components, hooks and lib, and the files at the root (proxy.ts). Not tests. */
function appSourceFiles(): string[] {
  const files: string[] = [];
  const isSource = (file: string) => /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/.test(file) && !/\.test\.tsx?$/.test(file);
  for (const folder of ["app", "components", "hooks", "lib"]) {
    for (const file of readdirSync(join(process.cwd(), folder), { recursive: true }) as string[]) {
      // A route folder can look like a file (app/sw.js serves the worker).
      const path = join(process.cwd(), folder, file);
      if (isSource(file) && statSync(path).isFile()) files.push(path);
    }
  }
  for (const file of readdirSync(process.cwd())) {
    if (isSource(file) && !/\.config\./.test(file) && !/^vitest\./.test(file)) files.push(join(process.cwd(), file));
  }
  return files;
}

/**
 * The module paths in `source` (written at `file`) that reach Supabase: anything resolving into lib/supabase, by the
 * "@/" alias or a relative path, and Supabase's own packages. Static imports and re-exports, import() and require().
 */
function supabaseImports(source: string, file: string): string[] {
  const specifiers = [
    ...source.matchAll(/\b(?:import|export)\b[^"';]*?\bfrom\s*["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\s*["']([^"']+)["']/g),
    ...source.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g),
  ].map((match) => match[1]);
  return specifiers.filter((specifier) => {
    if (specifier.startsWith("@supabase/")) return true;
    const target = specifier.startsWith("@/")
      ? join(process.cwd(), specifier.slice(2))
      : specifier.startsWith(".")
        ? resolve(dirname(file), specifier)
        : null;
    return target !== null && (target === SUPABASE_DIR || target.startsWith(`${SUPABASE_DIR}/`));
  });
}

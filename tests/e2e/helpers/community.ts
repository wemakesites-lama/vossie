import { expect, type Page } from "@playwright/test";
import { button, field, main } from "./messaging";
import { POST_LANDS } from "./selling";

// Shared by the community actions tests (community actions plan, Task 22). Every test shares one server and one
// sample store, so each posts its own requests, named with a word no other test uses (plan decision 27).

export const REQUEST_DETAILS = "A clip-on lamp for my desk at res, by the weekend please.";

/** A request page's address: `/looking-for/r-` and a UUID (new ids are made only in Server Actions). */
export const NEW_REQUEST_URL = /\/looking-for\/r-[0-9a-f-]{36}$/;

/** The id at the end of a new request's address. */
export const requestIdOf = (page: Page) => new URL(page.url()).pathname.split("/").pop()!;

/** Fills the request form that's showing in Res & living, at this campus. It sends nothing. */
export async function fillRequest(
  page: Page,
  title: string,
  { campus = "Midrand", details = REQUEST_DETAILS }: { campus?: string; details?: string } = {},
) {
  await field(page, "What you need").fill(title);
  await field(page, "Category").selectOption({ label: "Res & living" });
  await field(page, "Campus").selectOption({ label: campus });
  await field(page, "Details").fill(details);
}

/**
 * Posts a request from /looking-for/new as the signed-in student, in Res & living, and gives back its id. It ends on
 * the request's page. A post is a write to the one shared server, which a busy run slows (POST_LANDS).
 */
export async function postRequest(
  page: Page,
  title: string,
  options: { campus?: string; details?: string } = {},
): Promise<string> {
  await page.goto("/looking-for/new");
  await fillRequest(page, title, options);
  await button(page, "Post request").click();
  await expect(page).toHaveURL(NEW_REQUEST_URL, POST_LANDS);
  return requestIdOf(page);
}

/** The offers panel on the request page that's showing. */
export const offersPanel = (page: Page) => main(page).getByRole("region", { name: "Offers" });

/** The status line on the page that's showing (plan decision 7). */
export const statusLine = (page: Page) => main(page).getByRole("status");

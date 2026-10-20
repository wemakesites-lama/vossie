import { expect, type Page } from "@playwright/test";
import { main } from "./messaging";

// Shared by the saved-search tests (search alerts plan, Task 8). Every test shares one server and one sample store, so
// each signs up its own student and searches for a word no other test uses (plan decision 19).

/** A browse link for one word, with the campus pinned so no cookie changes it. */
export const searchAt = (word: string, campus = "midrand") => `/browse?q=${word}&campus=${campus}`;

/** The Save this search row on the page that's showing (a CSS locator, so only the visible copy). */
export const saveRow = (page: Page) => main(page).locator(".save-search").filter({ visible: true });

/** Presses Save this search on the browse page that's showing, and waits for "Search saved.". */
export async function pressSave(page: Page) {
  await saveRow(page).getByRole("button", { name: "Save this search" }).click();
  await expect(saveRow(page).getByRole("status")).toHaveText("Search saved.", { timeout: 20_000 });
}

/** The search-match lines on /notifications about this word's search. */
export const matchNotes = (page: Page, word: string) =>
  main(page).getByRole("link", { name: new RegExp(`match(es)? your search “${word}”`) });

/** The path and query of the page that's showing. */
export const pathOf = (page: Page) => {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
};

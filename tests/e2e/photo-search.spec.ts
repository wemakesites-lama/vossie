import { expect, test } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { button, field, main, onlyAt, settled, signInAsSample } from "./helpers/messaging";
import { photoWithLocation } from "./helpers/selling";

// Snap to search (AI features spec section 5, AI stage D). The e2e server answers with the fake: "casio calculator"
// in Tech at high confidence. A device spec, not a write project: the sample student is exempt from the daily count
// in sample mode, and nothing a buyer sees is written (stage D planning decision 8).

test.use({ reducedMotion: "reduce" });

test("a photo from the search overlay becomes a search on Browse (spec 5.1 to 5.3)", async ({ page }) => {
  await signInAsSample(page, "Student, Midrand", "/");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Search CampusCart" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: "Search with a photo" }).click();

  await expect(page).toHaveURL(/\/browse\/photo$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search with a photo");
  await field(page, "Photo").setInputFiles(photoWithLocation("calculator.png"));
  await button(page, "Search").click();

  // The URL holds only the search words (spec 5.3), with the category at high confidence.
  await expect(page).toHaveURL(/\/browse\?q=casio\+calculator&cat=tech$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("“casio calculator”");
  // The Casio is at Midrand, the student's campus; should the campus ever hide it, Browse points to other campuses.
  await expect(
    main(page)
      .getByRole("link", { name: /Casio fx-991ZA Plus calculator/ })
      .or(main(page).getByRole("link", { name: /more at (another campus|other campuses)/ }))
      .first(),
  ).toBeVisible();
});

test("signed out, the page offers sign-in that comes back to it (spec 5.4)", async ({ page }) => {
  await page.goto("/browse/photo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search with a photo");
  await expect(main(page).getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute(
    "href",
    "/login?next=%2Fbrowse%2Fphoto",
  );
  await expect(field(page, "Photo")).toHaveCount(0);
});

test("the photo page has no serious accessibility issues, signed in (spec 5.6)", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await signInAsSample(page, "Student, Midrand", "/browse/photo");
  await settled(page);
  await expect(field(page, "Photo")).toBeVisible();
  await expect(button(page, "Search")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

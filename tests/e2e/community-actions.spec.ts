import { expect, test } from "@playwright/test";
import { fillRequest } from "./helpers/community";
import { button, field, main, newBuyer, onlyAt, signInAsSample, signUp, signUpHere } from "./helpers/messaging";
import { POST_LANDS, uniqueWord } from "./helpers/selling";

// What community actions shows and checks without changing anything another test counts (community actions plan
// decision 27): the request form's refusals, the composer for someone who can't offer, Saved's Shops tab and Follow
// when signed out, and the sign-in page's way back. The tests that write what buyers see are in
// community-writes.spec.ts, which runs last. The click-through from each Post a request link, and Offer to help's
// round trip, are in community.spec.ts.

const BOTH = ["phone-390", "desktop-1440"];

test.describe("community actions (community actions spec section 6)", () => {
  test("the request form refuses contact details and keeps what was typed (spec 2.4)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/looking-for/new");
    const title = `Lamp ${uniqueWord()}`;
    await fillRequest(page, title, { details: "Call me on 082 123 4567 about a desk lamp." });
    await button(page, "Post request").click();
    const summary = main(page).getByRole("alert", { name: "There's a problem" });
    await expect(summary).toContainText("Take out the phone number or email. Shops will message you on Vossie.", POST_LANDS);
    // Nothing was made: the form is still there, with what was typed.
    await expect(page).toHaveURL(/\/looking-for\/new$/);
    await expect(field(page, "What you need")).toHaveValue(title);
    await expect(field(page, "Details")).toHaveValue("Call me on 082 123 4567 about a desk lamp.");
    await expect(field(page, "Details")).toHaveAttribute("aria-invalid", "true");
    await summary.getByRole("link").first().click();
    await expect(field(page, "Details")).toBeFocused();
  });

  test("an email address in the title is refused too, and an ISBN in the details passes the check (spec 2.4)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/looking-for/new");
    await fillRequest(page, `Mail sipho@gmail.com ${uniqueWord()}`, {
      details: "The textbook with ISBN 978-0-306-40615-7, please.",
    });
    await button(page, "Post request").click();
    const summary = main(page).getByRole("alert", { name: "There's a problem" });
    await expect(summary).toContainText("Take out the phone number or email.", POST_LANDS);
    // Only the title is wrong: the ISBN in the details wasn't taken for a phone number.
    await expect(field(page, "What you need")).toHaveAttribute("aria-invalid", "true");
    await expect(field(page, "Details")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("a student without a shop is told where offers come from (spec 2.8)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/looking-for/r-002/offer");
    await expect(main(page).getByRole("heading", { level: 1, name: "Offer to help" })).toBeVisible();
    const note = main(page).getByText("Offers come from shops on Vossie, so the Hub has checked who's offering.");
    await expect(note.filter({ visible: true })).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Start selling" })).toHaveAttribute("href", "/sell");
    // The note has replaced the form, so the page has drawn: this is a snapshot, not a wait.
    expect(await button(page, "Send offer").count()).toBe(0);
  });

  test("a shop can't offer on one of the sample requests, which have no asker to answer (spec 2.11)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Seller, Tech corner", "/looking-for/r-002/offer");
    await expect(main(page).getByRole("heading", { level: 1, name: "Offer to help" })).toBeVisible();
    await expect(
      main(page).getByText("This is one of Vossie's sample requests, so it can't take offers.").filter({ visible: true }),
    ).toBeVisible();
    expect(await button(page, "Send offer").count()).toBe(0);
  });

  test("a sample request has no asker, so its edit and delete pages are the 404 for a signed-in student (plan decision 24)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    for (const path of ["/looking-for/r-002/edit", "/looking-for/r-002/delete", "/looking-for/r-nope/edit"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveText("We couldn't find that page");
    }
  });

  test("Saved's Shops tab asks a signed-out visitor to sign in, and comes back to it (spec 2.17)", async ({ page }) => {
    onlyAt(...BOTH);
    await page.goto("/saved?tab=shops");
    const tabs = page.getByRole("navigation", { name: "What's saved" });
    await expect(tabs.getByRole("link", { name: "Shops", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("link", { name: "Listings", exact: true })).not.toHaveAttribute("aria-current", "page");
    await expect(main(page).getByText("Sign in to follow shops. They'll show here.").filter({ visible: true })).toBeVisible();
    await expect(main(page).getByText("Kept with your account.").filter({ visible: true })).toBeVisible();
    const signIn = main(page).getByRole("link", { name: "Sign in", exact: true });
    await expect(signIn).toHaveAttribute("href", "/login?next=%2Fsaved%3Ftab%3Dshops");

    await signIn.click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsaved%3Ftab%3Dshops$/);
    await button(page, "Student, Midrand").click();
    await expect(page).toHaveURL(/\/saved\?tab=shops$/);
    // Signed in, the sample student follows no one, and the tab says so.
    await expect(main(page).getByText("No shops yet").filter({ visible: true })).toBeVisible();
    await expect(main(page).getByText("Sign in to follow shops. They'll show here.")).toHaveCount(0);

    await tabs.getByRole("link", { name: "Listings", exact: true }).click();
    await expect(page).toHaveURL(/\/saved$/);
    await expect(tabs.getByRole("link", { name: "Listings", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(main(page).getByText(/^Saved on this device\./).filter({ visible: true })).toBeVisible();
  });

  test("Follow on a storefront goes through sign-in and back when signed out, and follows nothing (spec 2.16)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await page.goto("/sellers/tech-corner");
    // Exact names: "Follow Tech corner" is also a part of "Unfollow Tech corner" (plan amendment 20.1).
    const follow = page.getByRole("link", { name: "Follow Tech corner", exact: true });
    await expect(follow).toHaveAttribute("href", "/login?next=%2Fsellers%2Ftech-corner");
    await follow.click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsellers%2Ftech-corner$/);
    await signUpHere(page, newBuyer());
    await expect(page).toHaveURL(/\/sellers\/tech-corner$/, POST_LANDS);
    // Signed in, the band's part streams in: Follow is a button now, and it hasn't been pressed.
    await expect(page.getByRole("button", { name: "Follow Tech corner", exact: true })).toBeVisible();
    expect(await page.getByRole("button", { name: "Unfollow Tech corner", exact: true }).count()).toBe(0);
  });

  test("the sign-in page's back link leads back from the new pages (plan decision 22)", async ({ page }) => {
    onlyAt(...BOTH);
    // Offer to help's round trip is in community.spec.ts. These are direct visits to pages that need an account.
    for (const [path, back] of [
      ["/looking-for/new", "/looking-for"],
      ["/looking-for/r-002/edit", "/looking-for/r-002"],
      ["/looking-for/r-002/delete", "/looking-for/r-002"],
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
      const goBack = page.getByRole("link", { name: "Go back" });
      await expect(goBack, path).toHaveAttribute("href", back);
    }
    await page.getByRole("link", { name: "Go back" }).click();
    await expect(page).toHaveURL(/\/looking-for\/r-002$/);

    // Your requests has nowhere to go back to: it only comes back to sign-in.
    await page.goto("/account/requests");
    await expect(page).toHaveURL("/login?next=%2Faccount%2Frequests");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    expect(await page.getByRole("link", { name: "Go back" }).count()).toBe(0);
  });
});

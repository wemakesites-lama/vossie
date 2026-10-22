import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { authUserId, latestCode, newAddress, removeE2eAccounts, resetNetworkCounts, storedSession } from "./helpers/local";

// Your account on Supabase, end to end (phase B, Task 11): Edit details, Download your data and Delete my account,
// against the local stack. Run with `pnpm e2e:supabase`.

const project = () => test.info().project.name;
const main = (page: Page) => page.locator("main");
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const button = (page: Page, name: string) => main(page).getByRole("button", { name, exact: true });
const accountIcon = (page: Page) =>
  page.locator(".site-header, .tabbar").getByRole("link", { name: /^(Sign in|Your account|You)$/ });

/** Step 1 and step 2; a new address also finishes step 3. */
async function signIn(page: Page, email: string, { isNew = true } = {}) {
  await page.goto("/login");
  await field(page, "Your Eduvos email address").fill(email);
  await field(page, "I agree to the privacy policy").check();
  const asked = new Date();
  await button(page, "Send code").click();
  await field(page, "6-digit code").fill(await latestCode(email, asked));
  await button(page, "Sign in").click();
  if (!isNew) return;
  await field(page, "Your first name").fill("Ayanda");
  await field(page, "Your campus").selectOption({ label: "Pretoria" });
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/\/account$/);
}

// Every test posts from this machine: a fresh per-network count for each, as each has a fresh address (review fix 2).
test.beforeEach(() => resetNetworkCounts());
test.afterAll(() => removeE2eAccounts(test.info().project.name));

test.describe("your account on Supabase (phase B, Task 11)", () => {
  test("Edit details saves, and Download your data holds the address, one consent, one session and no ids", async ({ page }) => {
    const email = newAddress(project());
    await signIn(page, email);
    await field(page, "Your first name").fill("Lindiwe");
    await field(page, "Your campus").selectOption({ label: "Durban Umhlanga" });
    await button(page, "Save changes").click();
    await expect(main(page).getByRole("status")).toHaveText("Your details are saved.");
    await expect(main(page).getByRole("heading", { level: 2, name: "Lindiwe" })).toBeVisible();

    await page.goto("/account/privacy");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      main(page).getByRole("link", { name: "Download your data" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("campuscart-data.json");
    const text = await readFile((await download.path())!, "utf8");
    const data = JSON.parse(text);
    expect(data.account).toMatchObject({ email, firstName: "Lindiwe", campus: "durban-umhlanga" });
    expect(data.consents).toHaveLength(1);
    expect(data.sessions).toHaveLength(1);
    expect(Object.keys(data.sessions[0]).sort()).toEqual(["expiresAt", "signedInAt"]);
    // No id: not the account's, not the session's.
    const session = await storedSession(page.context());
    const sessionId = JSON.parse(Buffer.from(String(session!.access_token).split(".")[1], "base64url").toString()).session_id;
    expect(text).not.toContain(authUserId(email)!);
    expect(text).not.toContain(sessionId);
  });

  test("Delete my account asks for the box, then deletes the Auth user and signs out; the address starts again at step 3", async ({ page, baseURL }) => {
    const email = newAddress(project());
    await signIn(page, email);
    await page.goto("/account/privacy");
    await button(page, "Delete my account").click();
    await expect(main(page).getByRole("alert", { name: "There's a problem" })).toContainText("Tick the box to confirm you understand.");
    expect(authUserId(email)).not.toBeNull();

    await field(page, "I understand this can't be undone").check();
    await button(page, "Delete my account").click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(page.locator(".toast")).toHaveText("Your account has been deleted");
    await expect(accountIcon(page)).toHaveAttribute("href", "/login");
    expect(await storedSession(page.context())).toBeNull();
    expect(authUserId(email)).toBeNull();

    await signIn(page, email, { isNew: false });
    await expect(field(page, "Your first name")).toBeVisible();
  });
});

import { expect, test as setup } from "@playwright/test";

// The `setup` project (playwright.config.ts): every device project depends on it, and its teardown is the
// selling-writes project, so Playwright runs selling-writes once all five device projects have finished, passed or
// failed (selling plan decision 25). This one check is all it does.

setup("the server answers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
});

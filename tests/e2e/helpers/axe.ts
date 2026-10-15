import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/**
 * axe's serious and critical issues on the page that's showing, for the WCAG 2.0, 2.1 and 2.2 A and AA rules (2.5.8,
 * the 24px target size, among them). An empty list is a pass. Shared by a11y.spec.ts and the selling tests that need a
 * state only a write reaches (selling plan, Task 17).
 */
export async function seriousIssues(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
}

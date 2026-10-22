import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hubEyebrow } from "./paths";

// One name for the console (role views spec 7.2; N3 plan decision 7): every staff page in app/admin and app/hub takes
// its eyebrow from STAFF_EYEBROW, so no page writes "Admin console" or "Hub tools" itself. The Hub's pages say "Hub
// console" to an admin and "Hub tools" to a mentor, who has no console (Lama, N3 build).

const pagesUnder = (folder: string) =>
  (readdirSync(folder, { recursive: true }) as string[])
    .filter((file) => file.endsWith("page.tsx"))
    .map((file) => path.join(folder, file));

describe("the console's eyebrow", () => {
  it("comes from STAFF_EYEBROW on every admin page, and from hubEyebrow on every Hub staff page", () => {
    for (const [folder, eyebrow] of [
      ["app/admin", "area={STAFF_EYEBROW.admin}"],
      ["app/hub", "area={hubEyebrow(account)}"],
    ] as const) {
      const staffPages = pagesUnder(folder).filter((file) => readFileSync(file, "utf8").includes("<StaffFrame"));
      expect(staffPages.length, folder).toBeGreaterThan(0);
      for (const file of staffPages) {
        const source = readFileSync(file, "utf8");
        expect(source, file).toContain(eyebrow);
        expect(source, file).not.toMatch(/Admin console|Hub tools/);
      }
    }
  });

  it("is Hub console for an admin on the Hub's pages, Hub tools for a mentor", () => {
    expect(hubEyebrow({ roles: ["admin", "mentor"] })).toBe("Hub console");
    expect(hubEyebrow({ roles: ["mentor"] })).toBe("Hub tools");
  });
});

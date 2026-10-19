import { describe, expect, it } from "vitest";
import { OFFLINE_PAGE } from "@/lib/offline";
import { GET } from "./route";

describe("/offline (community actions spec 2.20)", () => {
  it("answers with the page as HTML, and tells search engines to leave it out", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await response.text()).toBe(OFFLINE_PAGE);
  });
});

import { describe, expect, it, vi } from "vitest";
import { workerSource } from "@/lib/offline";
import { GET } from "./route";

vi.mock("next/server", () => ({ connection: async () => undefined }));

describe("/sw.js (community actions spec 2.21)", () => {
  it("sends the worker as JavaScript with no-cache, so a fix arrives on the next visit", async () => {
    const response = await GET();
    expect(response.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(await response.text()).toBe(workerSource());
  });
});

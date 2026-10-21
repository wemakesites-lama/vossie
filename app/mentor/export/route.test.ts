import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { GET } from "./route";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

describe("the mentor dashboard's CSV (staff tools spec 2.6, plan decision 17)", () => {
  it("downloads the dashboard's table for a mentor, never cached", async () => {
    await signedInAs(request, "acc-mentor");
    const response = await GET();
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="campuscart-mentoring-2026-10-14.csv"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    // Amendment 12.2: the file starts with a UTF-8 byte-order mark, sent as it is. Response.text() would drop it, so
    // read the bytes and decode them keeping it. Amendment 12.1: every text cell is quoted, numbers are bare.
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const body = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body.slice(1).split("\r\n")).toEqual([
      '"Shop","Campus","Mentor","Badge","Status","Enquiries (14 days)","Due for a reply","Replied within 48 hours",' +
        '"Sales confirmed (14 days)","Flags"',
      '"Tech corner","Midrand","Naledi","Responsive","Open",2,2,2,0,""',
      "",
    ]);
  });

  it("sends a signed-out visitor to sign in for the dashboard, and gives a student the 404", async () => {
    expect(await redirectOf(() => GET())).toBe("/login?next=%2Fmentor");
    await signedInAs(request, "acc-student");
    await expect(GET()).rejects.toThrow("notFound");
  });

  it("leaves the viewer's own shop out of the file, for an admin too: nobody reads about themselves (stage L spec 2.5)", async () => {
    sampleStore().accounts.get("acc-seller")!.roles = ["admin"];
    await signedInAs(request, "acc-seller");
    const body = new TextDecoder("utf-8").decode(await (await GET()).arrayBuffer());
    expect(body).toContain('"Shop","Campus"');
    expect(body).not.toContain("Tech corner");
  });
});

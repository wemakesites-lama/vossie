import { describe, expect, it } from "vitest";
import { isSameOrigin, notFromVossie, seeOther } from "./same-origin";

/** The parts of a request the check reads. */
const from = (headers: Record<string, string>) => ({ headers: new Headers(headers) });

describe("posts that start or end a session come from Vossie (stage K spec decision 3)", () => {
  it("accepts a post whose Origin's host is the request's host", () => {
    expect(isSameOrigin(from({ origin: "http://localhost:3204", host: "localhost:3204" }))).toBe(true);
    expect(isSameOrigin(from({ origin: "https://vossie-pi.vercel.app", host: "vossie-pi.vercel.app" }))).toBe(true);
  });

  it("refuses Origin null, and a post with neither Origin nor a same-host Referer", () => {
    expect(isSameOrigin(from({ origin: "null", host: "localhost:3204", referer: "http://localhost:3204/login" }))).toBe(false);
    expect(isSameOrigin(from({ origin: "not a url", host: "localhost:3204" }))).toBe(false);
    expect(isSameOrigin(from({ host: "localhost:3204" }))).toBe(false);
    expect(isSameOrigin(from({ host: "localhost:3204", referer: "https://evil.example/x" }))).toBe(false);
  });

  it("accepts a post with no Origin when the Referer is a page on this host (proxy browsers)", () => {
    expect(isSameOrigin(from({ host: "localhost:3204", referer: "http://localhost:3204/login?next=%2Faccount" }))).toBe(true);
  });

  it("refuses another host, and another port", () => {
    expect(isSameOrigin(from({ origin: "https://evil.example", host: "localhost:3204" }))).toBe(false);
    expect(isSameOrigin(from({ origin: "http://localhost:3100", host: "localhost:3204" }))).toBe(false);
  });

  it("uses the first x-forwarded-host when the host sets it, as Next's own check does", () => {
    const proxied = { host: "internal:3000", "x-forwarded-host": "vossie.example, internal:3000" };
    expect(isSameOrigin(from({ ...proxied, origin: "https://vossie.example" }))).toBe(true);
    expect(isSameOrigin(from({ ...proxied, origin: "http://internal:3000" }))).toBe(false);
  });

  it("refuses when the request names no host at all", () => {
    expect(isSameOrigin(from({ origin: "http://localhost:3204" }))).toBe(false);
  });

  it("answers 403 in plain words, and 303 to a relative path that's never stored", async () => {
    const refused = notFromVossie();
    expect(refused.status).toBe(403);
    expect(refused.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await refused.text()).toBe("This form must be sent from Vossie.");
    const onward = seeOther("/looking-for/new");
    expect([onward.status, onward.headers.get("location"), onward.headers.get("cache-control")]).toEqual([
      303,
      "/looking-for/new",
      "no-store",
    ]);
  });
});

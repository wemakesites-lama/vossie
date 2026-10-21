import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

// The proxy (Supabase phase B, Task 6): which requests it sees, and that it hands each to lib/data's renewal. The
// installed Next 16.4 exports the matcher helper under its Middleware name only (amendment 13).

const renewal = vi.hoisted(() => ({ renewFromProxy: vi.fn(async () => new Response(null, { status: 299 })) }));
vi.mock("@/lib/data/session-renewal", () => renewal);

/** With a session cookie: the whole cookie, or the first of its chunks. */
const SIGNED_IN: Record<string, string>[] = [{ vossie_auth: "base64-x" }, { "vossie_auth.0": "base64-x", "vossie_auth.1": "y" }];
const matches = (url: string, cookies: Record<string, string> = SIGNED_IN[0]) =>
  unstable_doesMiddlewareMatch({ config, url, cookies });

describe("the proxy's matcher (phase B, Task 6)", () => {
  it("covers every page, Route Handler and Server Function post", () => {
    for (const url of [
      "/",
      "/account",
      "/account/privacy",
      "/login",
      "/login/code",
      "/logout",
      "/account/privacy/delete",
      "/account/privacy/export",
      "/sellers/tech-corner",
      "/sell/listings/new",
      "/browse?q=calculator",
      "/admin",
    ]) {
      for (const cookies of SIGNED_IN) expect(matches(url, cookies), url).toBe(true);
    }
  });

  it("leaves out every request without a session cookie: signed out, and everyone in sample mode", () => {
    for (const url of ["/", "/account", "/login/code", "/logout", "/sell/listings/new"]) {
      expect(matches(url, {}), url).toBe(false);
      expect(matches(url, { vossie_session: "x", vossie_campus: "pretoria", vossie_authx: "y", "vossie_auth.1": "z" }), url).toBe(false);
    }
  });

  it("leaves out static files, images, photos, the worker and the metadata files", () => {
    for (const url of [
      "/_next/static/chunks/main.js",
      "/_next/image?url=%2Fphotos%2Fa.webp&w=640&q=75",
      "/photos/abc",
      "/photos/abc/640",
      "/sw.js",
      "/favicon.ico",
      "/robots.txt",
      "/sitemap.xml",
      "/manifest.webmanifest",
      "/icons/icon-192.png",
      "/brand/crest.svg",
      "/fonts/a.woff2",
    ]) {
      expect(matches(url), url).toBe(false);
    }
  });
});

describe("the proxy (phase B, Task 6)", () => {
  it("hands the request to lib/data's renewal and returns its answer", async () => {
    const request = new NextRequest("https://vossie-pi.vercel.app/account");
    const response = await proxy(request);
    expect(renewal.renewFromProxy).toHaveBeenCalledWith(request);
    expect(response.status).toBe(299);
  });
});

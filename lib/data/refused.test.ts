import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RedirectSignal } from "@/tests/helpers/next-request";
import { isRefused, Refused, refusalOf } from "./refused";

// A database refusal the sample's return types have no room for (C2/C3 plan decision 3, amendment 3; C4/C5 plan
// decision 2): one module both plans' twins throw from and their actions catch with.

describe("Refused (C2/C3 plan decision 3)", () => {
  it("is an Error with its code and the name Refused", () => {
    const refused = new Refused("message-rate");
    expect(refused).toBeInstanceOf(Error);
    expect(refused.code).toBe("message-rate");
    expect(refused.name).toBe("Refused");
  });

  it("refusalOf gives what the promise gives", async () => {
    expect(await refusalOf(Promise.resolve(1))).toEqual({ ok: 1 });
  });

  it("and a refusal's code", async () => {
    expect(await refusalOf(Promise.reject(new Refused("conversation-rate")))).toEqual({ refused: "conversation-rate" });
  });

  it("and rethrows anything else, a redirect included", async () => {
    const error = new Error("boom");
    await expect(refusalOf(Promise.reject(error))).rejects.toBe(error);
    const redirect = new RedirectSignal("/", "replace");
    await expect(refusalOf(Promise.reject(redirect))).rejects.toBe(redirect);
  });

  it("isRefused is true only for the codes named, or any code when none is", () => {
    expect(isRefused(new Refused("once-taken"), "once-taken", "once-expired")).toBe(true);
    expect(isRefused(new Refused("once-expired"), "once-taken", "once-expired")).toBe(true);
    expect(isRefused(new Refused("own-shop"), "once-taken", "once-expired")).toBe(false);
    expect(isRefused(new Refused("own-shop"))).toBe(true);
  });

  it("and false for any other error, a redirect included", () => {
    expect(isRefused(new Error("x"))).toBe(false);
    expect(isRefused(new RedirectSignal("/", undefined))).toBe(false);
    expect(isRefused("own-shop")).toBe(false);
  });

  it("imports nothing, so client and sample code can read it", () => {
    const source = readFileSync(join(process.cwd(), "lib", "data", "refused.ts"), "utf8");
    expect(source).not.toMatch(/\bimport\b/);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bexport\b[^;]*\bfrom\b/);
  });
});

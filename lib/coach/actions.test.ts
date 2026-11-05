import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirectSignalOf } from "@/tests/helpers/next-request";
import { tickCoachAction } from "./actions";

const owner = vi.hoisted(() => ({
  current: { account: { id: "acc-1" }, shop: { slug: "zola" }, status: "approved" } as Record<string, unknown>,
}));
const tick = vi.hoisted(() => vi.fn(async () => "ticked"));

vi.mock("@/lib/selling/owner", () => ({ requireShopOwner: vi.fn(async () => owner.current) }));
vi.mock("@/lib/data/coach", () => ({ tickCoachAction: tick }));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/cache", async () => ({ refresh: vi.fn() }));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

beforeEach(() => {
  tick.mockClear();
  owner.current = { account: { id: "acc-1" }, shop: { slug: "zola" }, status: "approved" };
  vi.stubEnv("VOSSIE_AI_SHOP_COACH", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
});

describe("tickCoachAction (AI stage I1, Task 8)", () => {
  it("ticks with the session's account and shop, and lands on /sell", async () => {
    const signal = await redirectSignalOf(() => tickCoachAction(form({ action: "read-tip:t-1", from: "sell" })));
    expect(tick).toHaveBeenCalledWith("acc-1", "zola", "read-tip:t-1", expect.any(Date));
    expect(signal.url).toBe("/sell");
  });

  it("lands on /hub for from=hub, and on /sell for any other from", async () => {
    expect((await redirectSignalOf(() => tickCoachAction(form({ action: "check-price:l-1", from: "hub" })))).url).toBe("/hub");
    expect((await redirectSignalOf(() => tickCoachAction(form({ action: "check-price:l-1", from: "//evil.example" })))).url).toBe("/sell");
  });

  it("writes nothing for an action that isn't kind:target shaped, or of a kind the app checks itself", async () => {
    for (const action of ["", "nonsense", "read-tip:", "add-photos:l-1", "read-tip:T 1", "check-price:l-1:x"]) {
      const signal = await redirectSignalOf(() => tickCoachAction(form({ action, from: "hub" })));
      expect(signal.url).toBe("/hub");
    }
    expect(tick).not.toHaveBeenCalled();
  });

  it("writes nothing with the switch off, or for a shop that isn't approved", async () => {
    vi.stubEnv("VOSSIE_AI_SHOP_COACH", "0");
    await redirectSignalOf(() => tickCoachAction(form({ action: "read-tip:t-1" })));
    vi.stubEnv("VOSSIE_AI_SHOP_COACH", "1");
    owner.current = { ...owner.current, status: "paused" };
    await redirectSignalOf(() => tickCoachAction(form({ action: "read-tip:t-1" })));
    expect(tick).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeFormState } from "@/lib/auth/form-state";
import { resetSampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { takeNote } from "./form-state";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

describe("status lines (community actions plan decision 7)", () => {
  it("gives a page its status line once, then nothing", async () => {
    await signedInAs(request, "acc-student");
    await writeFormState("request-note:r-1", { errors: [], values: { shop: "Tech corner" }, notice: "posted" }, STAFF_NOW);
    expect(await takeNote("request-note:r-1")).toMatchObject({ notice: "posted", values: { shop: "Tech corner" } });
    expect(await takeNote("request-note:r-1")).toBeNull();
  });

  it("has nothing to give a signed-out visitor", async () => {
    expect(await takeNote("request-note:r-1")).toBeNull();
  });
});

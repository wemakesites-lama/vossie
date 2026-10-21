import { describe, vi } from "vitest";
import { actionContract, signInSample } from "@/tests/contract/actions";
import { sampleWorld } from "@/tests/contract/sample-world";
import type { FakeRequest } from "@/tests/helpers/next-request";
import { lookingForActionsContract } from "./actions.contract";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

describe("the Looking For actions on the sample store (C4/C5 plan Task 6)", () => {
  actionContract(sampleWorld, request, { signIn: signInSample(request) }, lookingForActionsContract);
});

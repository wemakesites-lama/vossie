import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { limitsContract } from "./limits.contract";

describe("the message limits' first look on the sample store (C2/C3 plan Task 15)", () => {
  limitsContract(sampleWorld);
});

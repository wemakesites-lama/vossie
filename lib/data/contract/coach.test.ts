import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { coachContract } from "./coach.contract";

describe("Shop coach's storage and facts on the sample store (AI stage I1, Task 6)", () => {
  coachContract(sampleWorld);
});

import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { worldContract } from "./world.contract";

describe("the world's verbs on the sample store (C4/C5 plan Task 3)", () => {
  worldContract(sampleWorld);
});

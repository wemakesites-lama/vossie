import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { statsContract } from "./stats.contract";

describe("shop stats and badges on the sample store (2b plan Task 19)", () => {
  statsContract(sampleWorld);
});

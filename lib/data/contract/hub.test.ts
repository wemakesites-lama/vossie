import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { hubContract } from "./hub.contract";

describe("the Hub's posts on the sample store (2b plan Task 16)", () => {
  hubContract(sampleWorld);
});

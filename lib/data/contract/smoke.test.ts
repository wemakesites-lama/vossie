import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { smokeContract } from "./smoke.contract";

describe("the contract harness on the sample store (2b plan Task 13)", () => {
  smokeContract(sampleWorld);
});

import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { offersContract } from "./offers.contract";

describe("offers, the request side, on the sample store (C4/C5 plan Task 5)", () => {
  offersContract(sampleWorld);
});

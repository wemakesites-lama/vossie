import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { shopsContract } from "./shops.contract";

describe("a seller's own shop on the sample store (C2/C3 plan Task 8)", () => {
  shopsContract(sampleWorld);
});

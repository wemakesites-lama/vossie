import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { ownListingsContract } from "./own-listings.contract";

describe("a shop's own listings on the sample store (C2/C3 plan Task 9)", () => {
  ownListingsContract(sampleWorld);
});

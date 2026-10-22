import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { sellerHomeContract } from "./seller-home.contract";

describe("the seller home's readers on the sample store (role views N2)", () => {
  sellerHomeContract(sampleWorld);
});

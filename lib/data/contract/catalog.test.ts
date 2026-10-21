import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { catalogContract } from "./catalog.contract";

describe("the catalog on the sample store (2b plan Task 15)", () => {
  catalogContract(sampleWorld);
});

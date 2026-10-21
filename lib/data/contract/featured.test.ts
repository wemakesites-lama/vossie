import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { featuredContract } from "./featured.contract";

describe("Featured on the sample store (2b plan Task 18)", () => {
  featuredContract(sampleWorld);
});

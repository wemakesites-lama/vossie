import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { listingCheckContract } from "./listing-check.contract";

describe("the listing check's reports on the sample store (AI stage B, Task 6)", () => {
  listingCheckContract(sampleWorld);
});

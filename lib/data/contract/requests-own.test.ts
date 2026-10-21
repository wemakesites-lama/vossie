import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { requestsOwnContract } from "./requests-own.contract";

describe("Looking For requests, the asker's side, on the sample store (C4/C5 plan Task 4)", () => {
  requestsOwnContract(sampleWorld);
});

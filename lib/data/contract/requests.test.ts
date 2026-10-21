import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { requestsContract } from "./requests.contract";

describe("Looking For requests on the sample store (2b plan Task 17)", () => {
  requestsContract(sampleWorld);
});

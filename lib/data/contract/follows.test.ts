import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { followsContract } from "./follows.contract";

describe("following shops on the sample store (C4/C5 plan Task 7)", () => {
  followsContract(sampleWorld);
});

import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { pinsPointsContract } from "./pins-points.contract";

describe("Featured pins and pickup point writes on the sample store (C4/C5 plan Task 17)", () => {
  pinsPointsContract(sampleWorld);
});

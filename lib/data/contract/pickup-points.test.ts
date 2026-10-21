import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { pickupPointsContract } from "./pickup-points.contract";

describe("pickup points on the sample store (2b plan Task 14)", () => {
  pickupPointsContract(sampleWorld);
});

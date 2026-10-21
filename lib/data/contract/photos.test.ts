import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { photosContract } from "./photos.contract";

describe("stored photos on the sample store (C2/C3 plan Task 5)", () => {
  photosContract(sampleWorld);
});

import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { requestMatchContract } from "./request-match.contract";

describe("a request's stored search and a first publish's matches, on the sample store (AI stage G Task 4)", () => {
  requestMatchContract(sampleWorld);
});

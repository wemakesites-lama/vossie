import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { messagesOfferContract } from "./messages-offer.contract";

describe("a shop's offer on the sample store (C2/C3 plan Task 16)", () => {
  messagesOfferContract(sampleWorld);
});

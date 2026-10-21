import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { staffPrivacyContract } from "./staff-privacy.contract";

describe("the staff tools' part of the download on the sample store (C4/C5 plan Task 21)", () => {
  staffPrivacyContract(sampleWorld);
});

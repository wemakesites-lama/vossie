import { describe, expect, it } from "vitest";
import { parseWarnings, SAFETY_TIPS, SCAM_TIPS, scamWarnings } from "./scam-check";

describe("the scam check (messaging spec 2.3, plan decision 9)", () => {
  it("lets ordinary messages through", () => {
    for (const text of [
      "Hi! Is this still available?",
      "Could we meet at the library entrance tomorrow at 13:00?",
      "I'll pay cash when I see it.",
      "Does the calculator decode fractions? What's the pinout on the headset jack?",
    ]) {
      expect(scamWarnings(text), text).toEqual([]);
    }
  });

  it("spots paying in advance", () => {
    expect(scamWarnings("Can you pay first and I'll bring it?")).toEqual(["advance"]);
    expect(scamWarnings("Please EFT upfront")).toEqual(["advance"]);
    expect(scamWarnings("Send the money in advance")).toEqual(["advance"]);
  });

  it("spots paying in advance said another way (messaging plan amendment 3, fix 2)", () => {
    expect(scamWarnings("Please pay before I bring it")).toEqual(["advance"]);
    expect(scamWarnings("Can you EFT me before we meet?")).toEqual(["advance"]);
    expect(scamWarnings("Transfer the money and I'll post it")).toEqual(["advance"]);
    expect(scamWarnings("Transfer the money and I will ship it")).toEqual(["advance"]);
    expect(scamWarnings("Cash send me R200 first")).toEqual(["advance"]);
    expect(scamWarnings("CashSend R200 before we meet")).toEqual(["advance"]);
    expect(scamWarnings("eWallet me R200")).toEqual(["advance"]);
    expect(scamWarnings("Just e-wallet me")).toEqual(["advance"]);
  });

  it("lets paying cash when you see it through, however it's put", () => {
    for (const text of [
      "I'll pay cash when I see it.",
      "Can I pay when I collect it?",
      "I'll bring cash to the library entrance. Can you bring the charger?",
      "I can meet before class. I'll pay when we meet.",
    ]) {
      expect(scamWarnings(text), text).toEqual([]);
    }
  });

  it("spots a deposit or a booking fee", () => {
    expect(scamWarnings("A deposit holds it for you")).toEqual(["deposit"]);
    expect(scamWarnings("There's a R50 booking fee")).toEqual(["deposit"]);
  });

  it("spots bank details", () => {
    expect(scamWarnings("Send me your banking details")).toEqual(["bank"]);
    expect(scamWarnings("What's your account number and branch code?")).toEqual(["bank"]);
  });

  it("spots a bank account being named (messaging plan amendment 3, fix 2)", () => {
    expect(scamWarnings("My bank account is 123")).toEqual(["bank"]);
    expect(scamWarnings("What's your bank acc?")).toEqual(["bank"]);
    expect(scamWarnings("Put it in my bank accounts")).toEqual(["bank"]);
    expect(scamWarnings("The bank accident was on the news")).toEqual([]);
  });

  it("spots a courier", () => {
    expect(scamWarnings("I can send it with Paxi")).toEqual(["courier"]);
    expect(scamWarnings("Courier is R99")).toEqual(["courier"]);
  });

  it("spots a code sent to a phone", () => {
    expect(scamWarnings("Send me the code you just got")).toEqual(["code"]);
    expect(scamWarnings("What's the OTP?")).toEqual(["code"]);
  });

  it("gives every kind that applies, in the tips' order, whatever the case", () => {
    expect(scamWarnings("PAY A DEPOSIT FIRST, then share the OTP")).toEqual(["advance", "deposit", "code"]);
  });

  it("reads warnings back from form state, dropping anything else", () => {
    expect(parseWarnings("code,deposit")).toEqual(["deposit", "code"]);
    expect(parseWarnings("nonsense,,toString")).toEqual([]);
    expect(parseWarnings(undefined)).toEqual([]);
  });

  it("always has three tips beside the composer, and one tip per warning", () => {
    expect(SAFETY_TIPS).toHaveLength(3);
    expect([...SCAM_TIPS.keys()]).toEqual(["advance", "deposit", "bank", "courier", "code"]);
  });
});

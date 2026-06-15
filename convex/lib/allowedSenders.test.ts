import { describe, expect, it } from "vitest";
import { isAllowedSender, normalizeSender } from "./allowedSenders";

describe("normalizeSender", () => {
  it("removes separators and normalizes casing", () => {
    expect(normalizeSender("890-220")).toBe("890220");
    expect(normalizeSender("Bancolombia")).toBe("bancolombia");
  });
});

describe("isAllowedSender", () => {
  it.each([
    "855-40",
    "852-86",
    "874-00",
    "857-84",
    "890220",
    "890-220",
    "890 220",
    "Bancolombia",
  ])("accepts %s", (sender) => {
    expect(isAllowedSender(sender)).toBe(true);
  });

  it("rejects unexpected senders", () => {
    expect(isAllowedSender("12345")).toBe(false);
  });
});

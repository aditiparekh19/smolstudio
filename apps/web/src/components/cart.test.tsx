import { describe, expect, it } from "vitest";

describe("web foundation", () => {
  it("uses INR for the initial commerce market", () => {
    expect(
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(1299),
    ).toContain("1,299");
  });
});

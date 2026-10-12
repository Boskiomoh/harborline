import { safeNext } from "@/lib/safe-next";
import { describe, expect, it } from "vitest";

describe("safeNext", () => {
  it("keeps same-site paths with their query and hash", () => {
    expect(safeNext("/inbox")).toBe("/inbox");
    expect(safeNext("/portal/tickets/12?tab=thread#latest")).toBe(
      "/portal/tickets/12?tab=thread#latest",
    );
  });

  it("rejects anything that would leave the site", () => {
    for (const value of [
      "//evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "/\t/evil.com",
      "https://evil.com",
      "evil.com",
      "javascript:alert(1)",
      "",
    ]) {
      expect(safeNext(value), value).toBeNull();
    }
  });

  it("rejects non-strings", () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { isValidEmail } from "./EmailChipInput";

describe("isValidEmail", () => {
  it("accepts a well-formed email address", () => {
    expect(isValidEmail("customer@example.com")).toBe(true);
  });

  it("accepts an email with subdomain and plus tag", () => {
    expect(isValidEmail("user+tag@mail.example.co.id")).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidEmail("  customer@example.com  ")).toBe(true);
  });

  it("rejects a string without @", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  it("rejects a string without a domain", () => {
    expect(isValidEmail("customer@")).toBe(false);
  });

  it("rejects a string with spaces", () => {
    expect(isValidEmail("customer name@example.com")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects a string without a TLD", () => {
    expect(isValidEmail("customer@example")).toBe(false);
  });
});

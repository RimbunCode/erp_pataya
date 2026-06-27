import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encodeTokenToBase64,
  escapeAttributeValue,
  simplifyInlineDisplayToken,
} from "./variableEncodingUtils";

describe("encodeTokenToBase64", () => {
  let originalWindow;

  beforeEach(() => {
    // Simulasikan environment browser dengan window.btoa
    originalWindow = globalThis.window;
    globalThis.window = {
      btoa: (str) => Buffer.from(str, "binary").toString("base64"),
    };
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it("encodes a simple string to base64", () => {
    const result = encodeTokenToBase64("hello");
    expect(result).toBe(Buffer.from("hello").toString("base64"));
  });

  it("encodes a token with special characters", () => {
    const token = "{{doc.customer_name}}";
    const result = encodeTokenToBase64(token);
    expect(result).toBe(Buffer.from(token).toString("base64"));
  });

  it("returns empty string for empty input", () => {
    expect(encodeTokenToBase64("")).toBe("");
  });

  it("returns empty string for null/undefined input", () => {
    expect(encodeTokenToBase64(null)).toBe("");
    expect(encodeTokenToBase64(undefined)).toBe("");
  });

  it("returns empty string when window is undefined", () => {
    delete globalThis.window;
    expect(encodeTokenToBase64("hello")).toBe("");
  });

  it("encodes unicode characters correctly", () => {
    const token = "{{doc.nama_pelanggan}}";
    const result = encodeTokenToBase64(token);
    // TextEncoder encodes to UTF-8 bytes, then btoa encodes those bytes
    const bytes = new TextEncoder().encode(token);
    const binary = String.fromCharCode(...bytes);
    const expected = Buffer.from(binary, "binary").toString("base64");
    expect(result).toBe(expected);
  });

  it("handles strings with spaces and punctuation", () => {
    const token = "formatCurrency doc.total_amount";
    const result = encodeTokenToBase64(token);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});

describe("escapeAttributeValue", () => {
  it("escapes ampersands", () => {
    expect(escapeAttributeValue("a&b")).toBe("a&amp;b");
  });

  it("escapes double quotes", () => {
    expect(escapeAttributeValue('a"b')).toBe("a&quot;b");
  });

  it("escapes less-than signs", () => {
    expect(escapeAttributeValue("a<b")).toBe("a&lt;b");
  });

  it("escapes greater-than signs", () => {
    expect(escapeAttributeValue("a>b")).toBe("a&gt;b");
  });

  it("escapes multiple special characters in one string", () => {
    expect(escapeAttributeValue('<div class="test">&')).toBe(
      "&lt;div class=&quot;test&quot;&gt;&amp;",
    );
  });

  it("returns empty string for empty input", () => {
    expect(escapeAttributeValue("")).toBe("");
  });

  it("returns empty string for default (no argument)", () => {
    expect(escapeAttributeValue()).toBe("");
  });

  it("leaves normal strings unchanged", () => {
    expect(escapeAttributeValue("hello world")).toBe("hello world");
  });

  it("converts non-string values to string", () => {
    expect(escapeAttributeValue(123)).toBe("123");
    expect(escapeAttributeValue(null)).toBe("null");
    // undefined triggers the default parameter (value = ""), so it returns ""
    expect(escapeAttributeValue(undefined)).toBe("");
  });

  it("handles strings with only special characters", () => {
    expect(escapeAttributeValue('&"<>')).toBe("&amp;&quot;&lt;&gt;");
  });
});

describe("simplifyInlineDisplayToken", () => {
  it("strips doc. prefix from fullKey when token is empty", () => {
    expect(simplifyInlineDisplayToken("doc.customer_name", "")).toBe(
      "{{customer_name}}",
    );
  });

  it("returns fullKey wrapped in {{ }} when no doc. prefix and token is empty", () => {
    expect(simplifyInlineDisplayToken("company_name", "")).toBe(
      "{{company_name}}",
    );
  });

  it("uses simplifyTokenDisplay when token is provided", () => {
    // simplifyTokenDisplay strips "doc." prefix from token inner content
    expect(simplifyInlineDisplayToken("doc.date", "{{doc.date}}")).toBe(
      "{{date}}",
    );
  });

  it("simplifies relation tokens", () => {
    expect(
      simplifyInlineDisplayToken(
        "doc.branch.name",
        "{{relation doc.branch.name}}",
      ),
    ).toBe("{{branch.name}}");
  });

  it("simplifies docInfo tokens", () => {
    expect(simplifyInlineDisplayToken("docInfo.name", "{{docInfo.name}}")).toBe(
      "{{name}}",
    );
  });

  it("simplifies company tokens", () => {
    expect(simplifyInlineDisplayToken("company.name", "{{company.name}}")).toBe(
      "{{name}}",
    );
  });

  it("handles empty fullKey and empty token", () => {
    expect(simplifyInlineDisplayToken("", "")).toBe("{{}}");
  });

  it("handles undefined arguments (defaults)", () => {
    expect(simplifyInlineDisplayToken()).toBe("{{}}");
  });

  it("handles fullKey with nested path and empty token", () => {
    expect(simplifyInlineDisplayToken("doc.customer.address", "")).toBe(
      "{{customer.address}}",
    );
  });

  it("does not strip non-doc prefixes from fullKey when token is empty", () => {
    expect(simplifyInlineDisplayToken("relation.branch", "")).toBe(
      "{{relation.branch}}",
    );
  });
});

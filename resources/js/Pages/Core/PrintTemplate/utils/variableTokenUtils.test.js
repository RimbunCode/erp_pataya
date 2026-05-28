import { describe, it, expect, vi } from "vitest";

// Mock formatValue dari CurrencyInput karena merupakan dependensi eksternal
vi.mock("@/Components/CurrencyInput", () => ({
  formatValue: ({ value, intlConfig, decimalScale }) => {
    // Simulasi sederhana: format angka sesuai locale "id" dan currency
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (intlConfig?.currency) {
      return `Rp ${num.toLocaleString("id-ID")}`;
    }
    const decimals = decimalScale ?? 0;
    return num.toLocaleString("id-ID", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  },
}));

import {
  formatColumnValue,
  getFormattedHandlebarToken,
  isFormattableType,
  resolveExampleValue,
  getHandlebarToken,
  getDisplayLabel,
} from "./variableTokenUtils";

describe("formatColumnValue", () => {
  it("returns empty string for null value", () => {
    expect(formatColumnValue(null, { type: "currency" })).toBe("");
  });

  it("returns empty string for undefined value", () => {
    expect(formatColumnValue(undefined, { type: "currency" })).toBe("");
  });

  it("returns empty string for empty string value", () => {
    expect(formatColumnValue("", { type: "number" })).toBe("");
  });

  it("formats currency value with default IDR", () => {
    const result = formatColumnValue(50000, { type: "currency" });
    expect(result).toContain("Rp");
    expect(result).toContain("50");
  });

  it("formats currency value with custom currency from column", () => {
    const result = formatColumnValue(100, {
      type: "currency",
      currency: "USD",
    });
    expect(result).toContain("Rp"); // Mock always returns Rp format
  });

  it("formats currency value from formatOptions.currency", () => {
    const result = formatColumnValue(100, {
      type: "currency",
      formatOptions: { currency: "EUR" },
    });
    expect(result).toContain("Rp");
  });

  it("formats numeric value with default 0 decimals", () => {
    const result = formatColumnValue(1234.567, { type: "numeric" });
    expect(result).toBeDefined();
    expect(result).not.toBe("");
  });

  it("formats number type with specified decimalScale", () => {
    const result = formatColumnValue(1234.5, {
      type: "number",
      decimalScale: 2,
    });
    expect(result).toBeDefined();
    expect(result).not.toBe("");
  });

  it("formats number type with formatOptions.decimals", () => {
    const result = formatColumnValue(99.9, {
      type: "number",
      formatOptions: { decimals: 3 },
    });
    expect(result).toBeDefined();
  });

  it("handles string numeric value for number type", () => {
    const result = formatColumnValue("42.5", { type: "numeric" });
    expect(result).toBeDefined();
    expect(result).not.toBe("");
  });

  it("returns string value for NaN numeric input", () => {
    const result = formatColumnValue("not-a-number", { type: "numeric" });
    expect(result).toBe("not-a-number");
  });

  it("returns string value for non-formattable type", () => {
    expect(formatColumnValue("hello", { type: "text" })).toBe("hello");
  });

  it("returns string value when column type is undefined", () => {
    expect(formatColumnValue("test", {})).toBe("test");
  });

  it("returns string value when column is null", () => {
    expect(formatColumnValue("test", null)).toBe("test");
  });

  it("converts number to string for non-formattable type", () => {
    expect(formatColumnValue(123, { type: "text" })).toBe("123");
  });
});

describe("getFormattedHandlebarToken", () => {
  it("returns company token for company parentType", () => {
    const variable = { name: "company_name", parentType: "company" };
    expect(getFormattedHandlebarToken(variable, "company_name")).toBe(
      "{{company.company_name}}",
    );
  });

  it("returns docInfo token for docInfo parentType", () => {
    const variable = { name: "invoice_no", parentType: "docInfo" };
    expect(getFormattedHandlebarToken(variable, "invoice_no")).toBe(
      "{{docInfo.invoice_no}}",
    );
  });

  it("returns docInfo token for docInfo type", () => {
    const variable = { name: "created_at", type: "docInfo" };
    expect(getFormattedHandlebarToken(variable, "created_at")).toBe(
      "{{docInfo.created_at}}",
    );
  });

  it("returns relation token for relation type", () => {
    const variable = { name: "customer", type: "relation" };
    expect(getFormattedHandlebarToken(variable, "customer")).toBe(
      "{{relation doc.customer}}",
    );
  });

  it("returns relation token preserving doc. prefix", () => {
    const variable = { name: "customer", type: "relation" };
    expect(getFormattedHandlebarToken(variable, "doc.customer")).toBe(
      "{{relation doc.customer}}",
    );
  });

  it("returns formatCurrency token for currency type with default IDR", () => {
    const variable = { name: "total", type: "currency" };
    expect(getFormattedHandlebarToken(variable, "total")).toBe(
      '{{formatCurrency doc.total "IDR"}}',
    );
  });

  it("returns formatCurrency token with custom currency", () => {
    const variable = { name: "amount", type: "currency", currency: "USD" };
    expect(getFormattedHandlebarToken(variable, "amount")).toBe(
      '{{formatCurrency doc.amount "USD"}}',
    );
  });

  it("returns formatCurrency token with formatOptions.currency", () => {
    const variable = {
      name: "price",
      type: "currency",
      formatOptions: { currency: "EUR" },
    };
    expect(getFormattedHandlebarToken(variable, "price")).toBe(
      '{{formatCurrency doc.price "EUR"}}',
    );
  });

  it("returns formatNumber token for numeric type with default 0 decimals", () => {
    const variable = { name: "qty", type: "numeric" };
    expect(getFormattedHandlebarToken(variable, "qty")).toBe(
      "{{formatNumber doc.qty 0}}",
    );
  });

  it("returns formatNumber token for number type with decimalScale", () => {
    const variable = { name: "weight", type: "number", decimalScale: 2 };
    expect(getFormattedHandlebarToken(variable, "weight")).toBe(
      "{{formatNumber doc.weight 2}}",
    );
  });

  it("returns formatNumber token with formatOptions.decimals", () => {
    const variable = {
      name: "rate",
      type: "numeric",
      formatOptions: { decimals: 4 },
    };
    expect(getFormattedHandlebarToken(variable, "rate")).toBe(
      "{{formatNumber doc.rate 4}}",
    );
  });

  it("returns plain doc token for regular type", () => {
    const variable = { name: "customer_name", type: "text" };
    expect(getFormattedHandlebarToken(variable, "customer_name")).toBe(
      "{{doc.customer_name}}",
    );
  });

  it("preserves existing doc. prefix in fullKey", () => {
    const variable = { name: "notes", type: "text" };
    expect(getFormattedHandlebarToken(variable, "doc.notes")).toBe(
      "{{doc.notes}}",
    );
  });
});

describe("isFormattableType", () => {
  it("returns true for currency type", () => {
    expect(isFormattableType("currency")).toBe(true);
  });

  it("returns true for numeric type", () => {
    expect(isFormattableType("numeric")).toBe(true);
  });

  it("returns true for number type", () => {
    expect(isFormattableType("number")).toBe(true);
  });

  it("returns false for text type", () => {
    expect(isFormattableType("text")).toBe(false);
  });

  it("returns false for relation type", () => {
    expect(isFormattableType("relation")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isFormattableType(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isFormattableType(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isFormattableType("")).toBe(false);
  });
});

describe("resolveExampleValue", () => {
  it("resolves top-level property from exampleData", () => {
    const data = { customer_name: "PT ABC" };
    expect(resolveExampleValue(data, "customer_name", "data")).toBe("PT ABC");
  });

  it("resolves nested property using dot notation", () => {
    const data = { customer: { name: "John", address: { city: "Jakarta" } } };
    expect(resolveExampleValue(data, "customer.name", "data")).toBe("John");
    expect(resolveExampleValue(data, "customer.address.city", "data")).toBe(
      "Jakarta",
    );
  });

  it("returns null for missing path", () => {
    const data = { name: "Test" };
    expect(resolveExampleValue(data, "nonexistent", "data")).toBeNull();
  });

  it("returns null for partially missing nested path", () => {
    const data = { customer: { name: "John" } };
    expect(
      resolveExampleValue(data, "customer.address.city", "data"),
    ).toBeNull();
  });

  it("returns null when exampleData is null", () => {
    expect(resolveExampleValue(null, "name", "data")).toBeNull();
  });

  it("returns null when exampleData is undefined", () => {
    expect(resolveExampleValue(undefined, "name", "data")).toBeNull();
  });

  it("returns null when path is empty", () => {
    expect(resolveExampleValue({ name: "Test" }, "", "data")).toBeNull();
  });

  it("returns null when path is null", () => {
    expect(resolveExampleValue({ name: "Test" }, null, "data")).toBeNull();
  });

  it("resolves preferences type from preferences object", () => {
    const data = { preferences: { locale: "id", theme: "dark" } };
    expect(resolveExampleValue(data, "locale", "preferences")).toBe("id");
    expect(resolveExampleValue(data, "theme", "preferences")).toBe("dark");
  });

  it("returns null for missing preference key", () => {
    const data = { preferences: { locale: "id" } };
    expect(resolveExampleValue(data, "missing_key", "preferences")).toBeNull();
  });

  it("returns null when preferences object is missing", () => {
    const data = { name: "Test" };
    expect(resolveExampleValue(data, "locale", "preferences")).toBeNull();
  });

  it("converts numeric value to string", () => {
    const data = { total: 50000 };
    expect(resolveExampleValue(data, "total", "data")).toBe("50000");
  });

  it("converts boolean value to string", () => {
    const data = { active: true };
    expect(resolveExampleValue(data, "active", "data")).toBe("true");
  });

  it("returns JSON string for object values", () => {
    const data = { meta: { key: "value" } };
    const result = resolveExampleValue(data, "meta", "data");
    expect(result).toBe('{"key":"value"}');
  });
});

describe("getHandlebarToken", () => {
  it("returns company token for company parentType", () => {
    const variable = { name: "company_name", parentType: "company" };
    expect(getHandlebarToken(variable)).toBe("{{company.company_name}}");
  });

  it("returns docInfo token for docInfo parentType", () => {
    const variable = { name: "invoice_no", parentType: "docInfo" };
    expect(getHandlebarToken(variable)).toBe("{{docInfo.invoice_no}}");
  });

  it("returns docInfo token for docInfo type", () => {
    const variable = { name: "created_at", type: "docInfo" };
    expect(getHandlebarToken(variable)).toBe("{{docInfo.created_at}}");
  });

  it("returns relation token for relation type", () => {
    const variable = { name: "customer", type: "relation" };
    expect(getHandlebarToken(variable)).toBe("{{relation doc.customer}}");
  });

  it("returns each loop token for relations type", () => {
    const variable = { name: "items", type: "relations" };
    expect(getHandlebarToken(variable)).toBe("{{#each doc.items}}...{{/each}}");
  });

  it("returns plain doc token for regular variable", () => {
    const variable = { name: "customer_name", type: "text" };
    expect(getHandlebarToken(variable)).toBe("{{doc.customer_name}}");
  });

  it("preserves existing doc. prefix in name", () => {
    const variable = { name: "doc.notes", type: "text" };
    expect(getHandlebarToken(variable)).toBe("{{doc.notes}}");
  });

  it("adds doc. prefix when name does not have it", () => {
    const variable = { name: "total", type: "text" };
    expect(getHandlebarToken(variable)).toBe("{{doc.total}}");
  });
});

describe("getDisplayLabel", () => {
  it("returns title when available", () => {
    const variable = { title: "Nama Pelanggan", name: "customer_name" };
    expect(getDisplayLabel(variable, () => "")).toBe("Nama Pelanggan");
  });

  it("returns translated titleTrans when title is not available", () => {
    const variable = {
      titleTrans: "fields.customer_name",
      name: "customer_name",
    };
    const t = (key) => `Translated: ${key}`;
    expect(getDisplayLabel(variable, t)).toBe(
      "Translated: fields.customer_name",
    );
  });

  it("returns name as fallback when title and titleTrans are not available", () => {
    const variable = { name: "customer_name" };
    expect(getDisplayLabel(variable, () => "")).toBe("customer_name");
  });

  it("returns title over titleTrans when both exist", () => {
    const variable = {
      title: "Direct Title",
      titleTrans: "fields.key",
      name: "key",
    };
    const t = (key) => `Translated: ${key}`;
    expect(getDisplayLabel(variable, t)).toBe("Direct Title");
  });

  it("returns name when titleTrans translation returns empty string", () => {
    const variable = { titleTrans: "fields.empty", name: "fallback_name" };
    const t = () => "";
    expect(getDisplayLabel(variable, t)).toBe("fallback_name");
  });

  it("returns name when titleTrans translation returns null", () => {
    const variable = { titleTrans: "fields.null", name: "fallback_name" };
    const t = () => null;
    expect(getDisplayLabel(variable, t)).toBe("fallback_name");
  });
});

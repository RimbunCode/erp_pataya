import { describe, expect, it } from "vitest";
import {
  formatHandlebarTemplate,
  normalizeInlineVariableTokenSpans,
} from "./templateFormatUtils";

describe("normalizeInlineVariableTokenSpans", () => {
  it("replaces inline token span with data-token value without moving table loop tokens", () => {
    const source = [
      '<table class="table table-bordered w-100" data-relations="items">',
      "<tbody>",
      "{{#each doc.items}}",
      "<tr>",
      '<td><span data-variable-inline="true" data-token="{{doc.code}}">{{code}}</span></td>',
      "</tr>",
      "{{/each}}",
      "</tbody>",
      "</table>",
    ].join("");

    const normalized = normalizeInlineVariableTokenSpans(source);

    expect(normalized).toContain("<tbody>{{#each doc.items}}<tr>");
    expect(normalized).toContain("<td>{{doc.code}}</td>");
    expect(normalized).toContain("</tr>{{/each}}</tbody>");
    expect(normalized).not.toContain("data-variable-inline");
  });

  it("uses data-token-b64 value when data-token is not available", () => {
    const token = "{{doc.item_name}}";
    const tokenB64 = Buffer.from(token, "utf8").toString("base64");
    const source = `<span data-variable-inline="true" data-token-b64="${tokenB64}">[item_name]</span>`;

    const normalized = normalizeInlineVariableTokenSpans(source);

    expect(normalized).toBe(token);
  });
});

describe("formatHandlebarTemplate", () => {
  it("keeps #each block around tr inside tbody after formatting", () => {
    const source =
      "<table><tbody>{{#each doc.items}}<tr><td>{{this.code}}</td></tr>{{/each}}</tbody></table>";

    const formatted = formatHandlebarTemplate(source);

    expect(formatted).toContain("<tbody>");
    expect(formatted).toContain("{{#each doc.items}}");
    expect(formatted).toContain("<tr><td>{{this.code}}</td></tr>");
    expect(formatted).toContain("{{/each}}");
    expect(formatted.indexOf("{{#each doc.items}}")).toBeLessThan(
      formatted.indexOf("<tr><td>{{this.code}}</td></tr>"),
    );
    expect(formatted.indexOf("{{/each}}")).toBeGreaterThan(
      formatted.indexOf("<tr><td>{{this.code}}</td></tr>"),
    );
  });
});

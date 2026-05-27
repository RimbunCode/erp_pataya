import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getColumnLabel } from "./gjsRelationsTable";

/**
 * Generates the toHTML output for a gjsRelationsTable component.
 * This replicates the logic from the toHTML() method in gjsRelationsTable.js
 * without requiring the full GrapesJS editor context.
 *
 * @param {object} options
 * @param {string} options.relationName - The relation name (data-relations attribute)
 * @param {Array} options.columnsConfig - Array of column definitions with show, order, name, type, expression
 * @returns {string} The generated HTML string
 */
function generateRelationTableHTML({ relationName, columnsConfig }) {
  if (!columnsConfig || !columnsConfig.length) {
    return "";
  }

  const visibleColumns = columnsConfig
    .filter((col) => col.show)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (visibleColumns.length === 0) {
    return "";
  }

  const relationTarget = relationName.startsWith("doc.")
    ? relationName
    : relationName
      ? `doc.${relationName}`
      : relationName;

  let html = `<table class="table table-bordered w-100" data-relations="${relationName}">`;

  html += `<thead>`;
  html += `<tr>`;
  html += `<th>#</th>`;
  for (const col of visibleColumns) {
    html += `<th>{{label "${col.name}"}}</th>`;
  }
  html += `</tr>`;
  html += `</thead>`;

  html += `<tbody>`;
  html += `{{#each ${relationTarget}}}`;
  html += `<tr>`;
  html += `<td style="text-align:center">{{idx}}</td>`;
  for (const col of visibleColumns) {
    const alignStyle =
      col.type === "currency" || col.type === "numeric" || col.type === "number"
        ? ' style="text-align:right"'
        : "";

    let cellContent;
    if (col.expression) {
      cellContent = col.expression;
    } else {
      const tokenPrefix = col.type === "relation" ? "relation " : "";
      cellContent = `{{${tokenPrefix}this.${col.name}}}`;
    }

    html += `<td${alignStyle}>${cellContent}</td>`;
  }
  html += `</tr>`;
  html += `{{/each}}`;
  html += `</tbody>`;
  html += `</table>`;

  return html;
}

export { generateRelationTableHTML };

/**
 * Property 1: Column label resolution follows fallback chain
 *
 * For any column definition with any combination of `titleTrans`, `title`, and `name` fields,
 * and for any locale, the `getColumnLabel` function SHALL return the translated value of
 * `titleTrans` if available, otherwise `title`, otherwise `name` — never returning undefined
 * or empty string when at least one field is present.
 *
 * **Validates: Requirements 3.1, 3.3**
 */
describe("Property 1: Column label resolution follows fallback chain", () => {
  // Arbitrary for non-empty trimmed strings (valid field values)
  const nonEmptyString = fc
    .string({ minLength: 1 })
    .filter((s) => s.trim().length > 0);

  // Arbitrary for locale codes
  const localeArb = fc.oneof(
    fc.constant("en"),
    fc.constant("id"),
    fc.constant("fr"),
    fc.constant("de"),
    fc.constant("es"),
    fc.constant("ja"),
    fc.constant("zh"),
  );

  it("returns translated titleTrans when translation is available and differs from key", () => {
    fc.assert(
      fc.property(
        nonEmptyString, // titleTrans key
        nonEmptyString.filter((s) => s.length > 1), // translated value (must differ from key)
        fc.option(nonEmptyString, { nil: undefined }), // optional title
        fc.option(nonEmptyString, { nil: undefined }), // optional name
        localeArb,
        (titleTrans, translatedValue, title, name, locale) => {
          // Ensure translated value differs from the key
          fc.pre(translatedValue !== titleTrans);

          const col = { titleTrans, title, name };
          const t = (key, _params, _locale) => {
            if (key === titleTrans) return translatedValue;
            return key;
          };

          const result = getColumnLabel(col, t, locale);
          expect(result).toBe(translatedValue);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("falls back to title when titleTrans translation returns the key itself", () => {
    fc.assert(
      fc.property(
        nonEmptyString, // titleTrans key
        nonEmptyString, // title
        fc.option(nonEmptyString, { nil: undefined }), // optional name
        localeArb,
        (titleTrans, title, name, locale) => {
          const col = { titleTrans, title, name };
          // Translation function returns the key itself (no translation available)
          const t = (key) => key;

          const result = getColumnLabel(col, t, locale);
          expect(result).toBe(title);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("falls back to name when titleTrans is unavailable and title is absent", () => {
    fc.assert(
      fc.property(
        nonEmptyString, // name
        localeArb,
        (name, locale) => {
          const col = { name };
          const t = (key) => key;

          const result = getColumnLabel(col, t, locale);
          expect(result).toBe(name);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("falls back to name when title is empty/whitespace-only", () => {
    fc.assert(
      fc.property(
        nonEmptyString, // name
        fc.constantFrom("", " ", "  ", "\t", "\n"), // empty/whitespace title
        localeArb,
        (name, title, locale) => {
          const col = { title, name };
          const t = (key) => key;

          const result = getColumnLabel(col, t, locale);
          expect(result).toBe(name);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("never returns undefined or empty string when at least one field is present", () => {
    fc.assert(
      fc.property(
        fc.record(
          {
            titleTrans: fc.option(nonEmptyString, { nil: undefined }),
            title: fc.option(nonEmptyString, { nil: undefined }),
            name: fc.option(nonEmptyString, { nil: undefined }),
          },
          { requiredKeys: [] },
        ),
        localeArb,
        fc.boolean(), // whether translation succeeds
        (fields, locale, translationSucceeds) => {
          // Ensure at least one field is present
          const hasAtLeastOne =
            fields.titleTrans || fields.title || fields.name;
          fc.pre(!!hasAtLeastOne);

          const col = {};
          if (fields.titleTrans !== undefined)
            col.titleTrans = fields.titleTrans;
          if (fields.title !== undefined) col.title = fields.title;
          if (fields.name !== undefined) col.name = fields.name;

          const t = (key, _params, _locale) => {
            if (translationSucceeds && key === col.titleTrans) {
              return "translated_" + key;
            }
            return key; // returns key itself = no translation
          };

          const result = getColumnLabel(col, t, locale);

          // Must never be undefined
          expect(result).not.toBeUndefined();
          // Must never be empty string when at least one field is present
          expect(result.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("respects the priority order: titleTrans (translated) > title > name", () => {
    fc.assert(
      fc.property(
        nonEmptyString, // titleTrans
        nonEmptyString, // title
        nonEmptyString, // name
        localeArb,
        (titleTrans, title, name, locale) => {
          const col = { titleTrans, title, name };

          // Case 1: Translation succeeds → returns translated value
          const translatedValue = "translated_" + titleTrans;
          const tSuccess = (key, _params, _locale) => {
            if (key === titleTrans) return translatedValue;
            return key;
          };
          expect(getColumnLabel(col, tSuccess, locale)).toBe(translatedValue);

          // Case 2: Translation fails (returns key) → returns title
          const tFail = (key) => key;
          expect(getColumnLabel(col, tFail, locale)).toBe(title);

          // Case 3: No titleTrans, no title → returns name
          const colNameOnly = { name };
          expect(getColumnLabel(colNameOnly, tFail, locale)).toBe(name);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("handles missing t function gracefully by falling back to title or name", () => {
    fc.assert(
      fc.property(
        nonEmptyString, // titleTrans
        nonEmptyString, // title
        nonEmptyString, // name
        (titleTrans, title, name) => {
          const col = { titleTrans, title, name };

          // When t is not a function, should skip titleTrans and fall back
          const result = getColumnLabel(col, null, "en");
          expect(result).toBe(title);

          // When t is undefined
          const result2 = getColumnLabel(col, undefined, "en");
          expect(result2).toBe(title);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("works correctly with various locale values", () => {
    fc.assert(
      fc.property(
        nonEmptyString, // titleTrans
        nonEmptyString, // title
        localeArb,
        (titleTrans, title, locale) => {
          const col = { titleTrans, title };

          // Translation function that uses locale
          const t = (key, _params, loc) => {
            if (loc && key === titleTrans) {
              return `${loc}_${key}`;
            }
            return key;
          };

          const result = getColumnLabel(col, t, locale);
          // With locale, translation should succeed (returns locale_key which differs from key)
          expect(result).toBe(`${locale}_${titleTrans}`);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 12: Relation table HTML export includes Bootstrap classes
 *
 * For any `gjsRelationsTable` component with at least one visible column,
 * calling `toHTML()` SHALL produce an HTML string containing a `<table>` element
 * with classes `table`, `table-bordered`, and `w-100`.
 *
 * **Validates: Requirements 19.3**
 */
describe("Property 12: Relation table HTML export includes Bootstrap classes", () => {
  // Arbitrary for valid column names (alphanumeric + underscore, non-empty)
  const columnNameArb = fc
    .stringMatching(/^[a-z][a-z0-9_]*$/)
    .filter((s) => s.length >= 1 && s.length <= 30);

  // Arbitrary for column types
  const columnTypeArb = fc.constantFrom(
    "data",
    "currency",
    "numeric",
    "number",
    "relation",
  );

  // Arbitrary for a single visible column definition
  const visibleColumnArb = fc.record({
    name: columnNameArb,
    type: columnTypeArb,
    show: fc.constant(true),
    order: fc.integer({ min: 0, max: 100 }),
    expression: fc.constant(undefined),
  });

  // Arbitrary for a column that may or may not be visible
  const columnArb = fc.record({
    name: columnNameArb,
    type: columnTypeArb,
    show: fc.boolean(),
    order: fc.integer({ min: 0, max: 100 }),
    expression: fc.option(
      fc.constantFrom(
        "{{multiply this.quantity this.price}}",
        "{{add this.subtotal this.tax}}",
      ),
      { nil: undefined },
    ),
  });

  // Arbitrary for relation names
  const relationNameArb = fc
    .stringMatching(/^[a-z][a-zA-Z0-9_]*$/)
    .filter((s) => s.length >= 1 && s.length <= 30);

  it("output contains <table> element with classes table, table-bordered, and w-100 when at least one column is visible", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc
          .array(columnArb, { minLength: 1, maxLength: 15 })
          .filter((cols) => cols.some((c) => c.show)),
        (relationName, columnsConfig) => {
          const html = generateRelationTableHTML({
            relationName,
            columnsConfig,
          });

          // Must contain a <table element
          expect(html).toContain("<table");

          // Must contain all three Bootstrap classes
          expect(html).toContain("table");
          expect(html).toContain("table-bordered");
          expect(html).toContain("w-100");

          // Verify the exact class attribute format on the table element
          expect(html).toMatch(/<table\s+class="table table-bordered w-100"/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("table element always starts with the correct class attribute regardless of column configuration", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.array(visibleColumnArb, { minLength: 1, maxLength: 20 }),
        (relationName, columnsConfig) => {
          const html = generateRelationTableHTML({
            relationName,
            columnsConfig,
          });

          // The HTML must start with the table tag containing Bootstrap classes
          expect(
            html.startsWith('<table class="table table-bordered w-100"'),
          ).toBe(true);

          // Must also end with closing table tag
          expect(html.endsWith("</table>")).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("produces valid table structure with thead and tbody when columns are visible", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.array(visibleColumnArb, { minLength: 1, maxLength: 10 }),
        (relationName, columnsConfig) => {
          const html = generateRelationTableHTML({
            relationName,
            columnsConfig,
          });

          // Must contain thead and tbody sections
          expect(html).toContain("<thead>");
          expect(html).toContain("</thead>");
          expect(html).toContain("<tbody>");
          expect(html).toContain("</tbody>");

          // Must contain the relation name in data-relations attribute
          expect(html).toContain(`data-relations="${relationName}"`);

          // Must contain the Handlebars each loop with the relation name
          expect(html).toContain(`{{#each doc.${relationName}}}`);
          expect(html).toContain("{{/each}}");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("includes a header cell for each visible column", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.array(visibleColumnArb, { minLength: 1, maxLength: 10 }),
        (relationName, columnsConfig) => {
          const html = generateRelationTableHTML({
            relationName,
            columnsConfig,
          });

          // Sort by order to match the output
          const sorted = [...columnsConfig].sort(
            (a, b) => (a.order ?? 0) - (b.order ?? 0),
          );

          // Each visible column should have a th with its label helper
          for (const col of sorted) {
            expect(html).toContain(`<th>{{label "${col.name}"}}</th>`);
          }

          // Should also have the # header
          expect(html).toContain("<th>#</th>");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("produces empty string when no columns are visible", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.array(
          fc.record({
            name: columnNameArb,
            type: columnTypeArb,
            show: fc.constant(false),
            order: fc.integer({ min: 0, max: 100 }),
            expression: fc.constant(undefined),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (relationName, columnsConfig) => {
          const html = generateRelationTableHTML({
            relationName,
            columnsConfig,
          });

          // When no columns are visible, should produce empty string
          expect(html).toBe("");
        },
      ),
      { numRuns: 100 },
    );
  });
});

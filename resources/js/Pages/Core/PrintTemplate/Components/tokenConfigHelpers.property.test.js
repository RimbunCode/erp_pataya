/**
 * Property-Based Tests for tokenConfigHelpers.js
 *
 * Property 2: Tree structure building preserves parent-child hierarchy
 * Property 3: Token label formatting
 * Property 5: Relation token generation with path normalization
 * Property 6: Token display simplification
 * Property 7: RelationPath option filtering
 * Property 8: Relation node pruning hides nodes without relations descendants
 * Property 9: Nested relation full path construction
 * Property 10: DocInfo token generation
 *
 * Validates: Requirements 6.5, 7.1, 7.2, 7.3, 9.1, 9.3, 9.4, 10.1, 10.2, 10.4, 10.5, 12.1, 12.3, 15.4, 15.5
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildTreeOptions,
  formatTokenLabel,
  generateRelationToken,
  simplifyTokenDisplay,
  generateDocInfoToken,
  filterRelationPathOptions,
} from "./tokenConfigHelpers";

// --- Arbitraries for Property 2 ---

/**
 * Generate a valid column name from a fixed pool of realistic names.
 */
const columnNameArb = fc.constantFrom(
  "name",
  "code",
  "date",
  "amount",
  "price",
  "qty",
  "total",
  "branch",
  "customer",
  "items",
  "address",
  "phone",
  "email",
  "status",
  "type",
  "notes",
  "desc",
  "ref",
  "tax",
  "discount",
);

/**
 * Generate a leaf column (no nested columns).
 */
const leafColumnArb = fc.record({
  name: columnNameArb,
  title: fc.option(fc.constantFrom("Name", "Code", "Date", "Amount", "Price"), {
    nil: undefined,
  }),
  titleTrans: fc.option(fc.constantFrom("Nama", "Kode", "Tanggal", "Jumlah"), {
    nil: undefined,
  }),
  type: fc.constantFrom("data", "relation", "relations", ""),
});

/**
 * Generate a column with one level of children (depth 2).
 */
const columnWithChildrenArb = fc.record({
  name: columnNameArb,
  title: fc.option(fc.constantFrom("Branch", "Customer", "Items", "Orders"), {
    nil: undefined,
  }),
  titleTrans: fc.option(fc.constantFrom("Cabang", "Pelanggan", "Item"), {
    nil: undefined,
  }),
  type: fc.constantFrom("relation", "relations"),
  columns: fc.array(leafColumnArb, { minLength: 1, maxLength: 4 }),
});

/**
 * Generate a column with two levels of nesting (depth 3).
 */
const deepColumnArb = fc.record({
  name: columnNameArb,
  title: fc.option(fc.constantFrom("Deep Parent", "Nested"), {
    nil: undefined,
  }),
  type: fc.constantFrom("relation", "relations"),
  columns: fc.array(
    fc.record({
      name: columnNameArb,
      title: fc.option(fc.constantFrom("Mid Level", "Child"), {
        nil: undefined,
      }),
      type: fc.constantFrom("relation", "relations", "data", ""),
      columns: fc.array(leafColumnArb, { minLength: 0, maxLength: 3 }),
    }),
    { minLength: 1, maxLength: 3 },
  ),
});

/**
 * Generate a mixed array of columns (some with children, some without).
 * Excludes top-level "data"/"preferences" containers to test direct hierarchy.
 */
const mixedColumnsArb = fc.array(
  fc.oneof(
    { arbitrary: leafColumnArb, weight: 2 },
    { arbitrary: columnWithChildrenArb, weight: 3 },
    { arbitrary: deepColumnArb, weight: 1 },
  ),
  { minLength: 1, maxLength: 5 },
);

/**
 * Generate columns specifically with relation types to test nesting.
 */
const relationColumnsArb = fc.array(columnWithChildrenArb, {
  minLength: 1,
  maxLength: 4,
});

// --- Arbitraries for Properties 3, 5, 6, 10 ---

/**
 * Generate a valid field name segment (alphanumeric + underscores, no dots).
 * Uses a pool of realistic field names for efficiency.
 */
const fieldNameSegmentArb = fc.constantFrom(
  "name",
  "code",
  "date",
  "amount",
  "price",
  "qty",
  "total",
  "branch",
  "customer",
  "address",
  "phone",
  "email",
  "status",
  "type",
  "notes",
  "description",
  "reference",
  "tax_amount",
  "discount_rate",
  "created_at",
  "updated_at",
  "company_name",
  "street_address",
  "postal_code",
  "order_number",
);

/**
 * Generate a dot-notation path with 1-4 segments.
 */
const dotPathArb = fc
  .array(fieldNameSegmentArb, { minLength: 1, maxLength: 4 })
  .map((segments) => segments.join("."));

/**
 * Generate a relation name (without "doc." prefix) — 1-3 segments.
 */
const relationNameArb = fc
  .array(fieldNameSegmentArb, { minLength: 1, maxLength: 3 })
  .map((segments) => segments.join("."));

// --- Arbitraries for Properties 7, 8, 9 ---

/**
 * Generate a "relations" leaf node (selectable target).
 */
const relationsLeafArb = fc.record({
  label: fc.constantFrom(
    "Items",
    "Orders",
    "Invoices",
    "Payments",
    "Lines",
    "Details",
  ),
  value: fc.constantFrom(
    "items",
    "orders",
    "invoices",
    "payments",
    "lines",
    "details",
  ),
  type: fc.constant("relations"),
  children: fc.constant([]),
});

/**
 * Generate a "data" leaf node (should be excluded from relation path).
 */
const dataLeafArb = fc.record({
  label: fc.constantFrom("Name", "Code", "Date", "Amount"),
  value: fc.constantFrom("name", "code", "date", "amount"),
  type: fc.constant("data"),
  children: fc.constant([]),
});

/**
 * Generate a "preferences" leaf node (should be excluded from relation path).
 */
const preferencesLeafArb = fc.record({
  label: fc.constantFrom("Company", "Logo", "Address"),
  value: fc.constantFrom("company", "logo", "address"),
  type: fc.constant("preferences"),
  children: fc.constant([]),
});

/**
 * Generate a "relation" node that HAS at least one "relations" descendant.
 */
const relationWithRelationsChildArb = fc.record({
  label: fc.constantFrom("Branch", "Customer", "Supplier", "Warehouse"),
  value: fc.constantFrom("branch", "customer", "supplier", "warehouse"),
  type: fc.constant("relation"),
  children: fc
    .tuple(
      fc.array(relationsLeafArb, { minLength: 1, maxLength: 3 }),
      fc.array(dataLeafArb, { minLength: 0, maxLength: 2 }),
    )
    .map(([relations, data]) => [...relations, ...data]),
});

/**
 * Generate a "relation" node that has NO "relations" descendants.
 */
const relationWithoutRelationsChildArb = fc.record({
  label: fc.constantFrom("Author", "Editor", "Manager", "Owner"),
  value: fc.constantFrom("author", "editor", "manager", "owner"),
  type: fc.constant("relation"),
  children: fc.array(dataLeafArb, { minLength: 0, maxLength: 3 }),
});

/**
 * Generate a deeply nested structure: relation → relation → relations.
 */
const deepNestedRelationArb = fc
  .record({
    outerLabel: fc.constantFrom("Branch", "Customer", "Supplier"),
    outerValue: fc.constantFrom("branch", "customer", "supplier"),
    innerLabel: fc.constantFrom("Department", "Division", "Unit"),
    innerValue: fc.constantFrom("department", "division", "unit"),
    relationsLabel: fc.constantFrom("Items", "Orders", "Employees"),
    relationsValue: fc.constantFrom("items", "orders", "employees"),
  })
  .map(
    ({
      outerLabel,
      outerValue,
      innerLabel,
      innerValue,
      relationsLabel,
      relationsValue,
    }) => ({
      label: outerLabel,
      value: outerValue,
      type: "relation",
      children: [
        {
          label: innerLabel,
          value: `${outerValue}.${innerValue}`,
          type: "relation",
          children: [
            {
              label: relationsLabel,
              value: `${outerValue}.${innerValue}.${relationsValue}`,
              type: "relations",
              children: [],
            },
          ],
        },
      ],
    }),
  );

/**
 * Generate a mixed tree with various node types for comprehensive testing.
 */
const mixedRelationTreeArb = fc.array(
  fc.oneof(
    { arbitrary: relationsLeafArb, weight: 2 },
    { arbitrary: dataLeafArb, weight: 2 },
    { arbitrary: preferencesLeafArb, weight: 1 },
    { arbitrary: relationWithRelationsChildArb, weight: 3 },
    { arbitrary: relationWithoutRelationsChildArb, weight: 2 },
    { arbitrary: deepNestedRelationArb, weight: 1 },
  ),
  { minLength: 1, maxLength: 8 },
);

// --- Helper functions for verification ---

/**
 * Count the number of named columns in a source array.
 * @param {Array} columns - Source columns array to inspect
 * @returns {number} Count of valid named columns
 */
function countValidColumns(columns) {
  if (!Array.isArray(columns)) return 0;
  return columns.filter((col) => col && typeof col === "object" && col.name)
    .length;
}

/**
 * Get the maximum nesting depth of a source columns array.
 * @param {Array} columns - Source columns array to inspect
 * @param {number} currentDepth - Current recursion depth
 * @returns {number} Maximum nesting depth found
 */
function getSourceDepth(columns, currentDepth = 0) {
  if (!Array.isArray(columns) || columns.length === 0) return currentDepth;
  let maxDepth = currentDepth;
  for (const col of columns) {
    if (col && typeof col === "object" && col.name) {
      if (Array.isArray(col.columns) && col.columns.length > 0) {
        const isTopLevelContainer =
          (col.type === "doc" || col.type === "company") && currentDepth === 0;
        if (isTopLevelContainer) {
          const childDepth = getSourceDepth(col.columns, currentDepth);
          maxDepth = Math.max(maxDepth, childDepth);
        } else {
          const childDepth = getSourceDepth(col.columns, currentDepth + 1);
          maxDepth = Math.max(maxDepth, childDepth);
        }
      } else {
        maxDepth = Math.max(maxDepth, currentDepth);
      }
    }
  }
  return maxDepth;
}

/**
 * Get the maximum nesting depth of the output tree.
 * @param {Array} options - Tree-structured options to inspect
 * @param {number} currentDepth - Current recursion depth
 * @returns {number} Maximum nesting depth found
 */
function getTreeDepth(options, currentDepth = 0) {
  if (!Array.isArray(options) || options.length === 0) return currentDepth;
  let maxDepth = currentDepth;
  for (const opt of options) {
    if (Array.isArray(opt.children) && opt.children.length > 0) {
      const childDepth = getTreeDepth(opt.children, currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    } else {
      maxDepth = Math.max(maxDepth, currentDepth);
    }
  }
  return maxDepth;
}

/**
 * Collect all nodes from a filtered tree (flattened).
 * @param {Array} tree - Tree-structured nodes to flatten
 * @returns {Array} Flattened array of all nodes
 */
function collectAllNodes(tree) {
  const nodes = [];
  for (const node of tree) {
    nodes.push(node);
    if (Array.isArray(node.children) && node.children.length > 0) {
      nodes.push(...collectAllNodes(node.children));
    }
  }
  return nodes;
}

/**
 * Check if a node has any descendant with type "relations".
 * @param {object} node - Tree node to inspect
 * @returns {boolean} True if a descendant with type "relations" exists
 */
function nodeHasRelationsDescendant(node) {
  if (!node || !Array.isArray(node.children)) return false;
  for (const child of node.children) {
    if (child.type === "relations") return true;
    if (child.type === "relation" && nodeHasRelationsDescendant(child))
      return true;
  }
  return false;
}

// ============================================================================
// Property 2: Tree structure building preserves parent-child hierarchy
// ============================================================================

describe("Property 2: Tree structure building preserves parent-child hierarchy", () => {
  it("children count matches source columns count for each node", () => {
    fc.assert(
      fc.property(mixedColumnsArb, (columns) => {
        const result = buildTreeOptions(columns);

        function verifyChildrenCount(sourceColumns, outputNodes, isRoot) {
          const validSource = sourceColumns.filter((col) => {
            if (!col || typeof col !== "object" || !col.name) return false;
            if (
              isRoot &&
              (col.type === "doc" || col.type === "company") &&
              Array.isArray(col.columns) &&
              col.columns.length > 0
            ) {
              return false;
            }
            return true;
          });

          if (!isRoot) {
            expect(outputNodes.length).toBe(validSource.length);
          }

          for (
            let i = 0;
            i < validSource.length && i < outputNodes.length;
            i++
          ) {
            const outputNode = outputNodes[i];
            const sourceCol = validSource[i];

            if (
              sourceCol &&
              Array.isArray(sourceCol.columns) &&
              sourceCol.columns.length > 0
            ) {
              const expectedChildCount = countValidColumns(sourceCol.columns);
              expect(outputNode.children.length).toBe(expectedChildCount);
              verifyChildrenCount(
                sourceCol.columns,
                outputNode.children,
                false,
              );
            } else {
              expect(outputNode.children).toEqual([]);
            }
          }
        }

        verifyChildrenCount(columns, result, true);
      }),
      { numRuns: 100 },
    );
  });

  it("preserves order of children matching source columns order", () => {
    fc.assert(
      fc.property(relationColumnsArb, (columns) => {
        const result = buildTreeOptions(columns);

        for (let i = 0; i < result.length; i++) {
          const sourceCol = columns[i];
          const outputNode = result[i];

          if (
            sourceCol &&
            Array.isArray(sourceCol.columns) &&
            sourceCol.columns.length > 0
          ) {
            const sourceChildNames = sourceCol.columns
              .filter((c) => c && c.name)
              .map((c) => c.name);
            const outputChildValues = outputNode.children.map((c) => {
              const parts = c.value.split(".");
              return parts[parts.length - 1];
            });

            expect(outputChildValues).toEqual(sourceChildNames);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("nesting depth of output matches source nesting depth", () => {
    fc.assert(
      fc.property(mixedColumnsArb, (columns) => {
        const result = buildTreeOptions(columns);
        const sourceDepth = getSourceDepth(columns);
        const treeDepth = getTreeDepth(result);

        expect(treeDepth).toBe(sourceDepth);
      }),
      { numRuns: 100 },
    );
  });

  it("every output node has label, value, type, and children fields", () => {
    fc.assert(
      fc.property(mixedColumnsArb, (columns) => {
        const result = buildTreeOptions(columns);

        function verifyStructure(nodes) {
          for (const node of nodes) {
            expect(node).toHaveProperty("label");
            expect(node).toHaveProperty("value");
            expect(node).toHaveProperty("type");
            expect(node).toHaveProperty("children");
            expect(Array.isArray(node.children)).toBe(true);
            expect(typeof node.label).toBe("string");
            expect(typeof node.value).toBe("string");
            expect(typeof node.type).toBe("string");

            if (node.children.length > 0) {
              verifyStructure(node.children);
            }
          }
        }

        verifyStructure(result);
      }),
      { numRuns: 100 },
    );
  });

  it("child values are prefixed with parent value (dot-notation path)", () => {
    fc.assert(
      fc.property(relationColumnsArb, (columns) => {
        const result = buildTreeOptions(columns);

        function verifyPaths(nodes) {
          for (const node of nodes) {
            if (node.children.length > 0) {
              for (const child of node.children) {
                expect(child.value.startsWith(node.value + ".")).toBe(true);
              }
              verifyPaths(node.children);
            }
          }
        }

        verifyPaths(result);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 3: Token label formatting
// ============================================================================

describe("Property 3: Token label formatting", () => {
  /**
   * Validates: Requirements 7.1, 7.2, 7.3
   *
   * For any field name string, the token label formatting function SHALL produce
   * output in the format `{{<field_name>}}` without path prefixes, arrow separators,
   * or "doc." prefix.
   */

  it("produces {{last_segment}} format for any dot-notation path", () => {
    fc.assert(
      fc.property(dotPathArb, (path) => {
        const option = { label: path.split(".").pop(), value: path };
        const result = formatTokenLabel(option);

        const lastSegment = path.split(".").pop();
        expect(result).toBe(`{{${lastSegment}}}`);
      }),
      { numRuns: 100 },
    );
  });

  it("never contains path prefixes or arrow separators", () => {
    fc.assert(
      fc.property(dotPathArb, (path) => {
        const option = { label: path.split(".").pop(), value: path };
        const result = formatTokenLabel(option);

        // Should not contain " -> " arrow separator
        expect(result).not.toContain(" -> ");
        // If path has dots, the result should only have the last segment
        if (path.includes(".")) {
          const segments = path.split(".");
          // Result should not contain the full path
          expect(result).not.toContain(path);
          // Result should only contain the last segment wrapped in {{ }}
          expect(result).toBe(`{{${segments[segments.length - 1]}}}`);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("wraps output in double curly braces", () => {
    fc.assert(
      fc.property(dotPathArb, (path) => {
        const option = { label: path.split(".").pop(), value: path };
        const result = formatTokenLabel(option);

        expect(result.startsWith("{{")).toBe(true);
        expect(result.endsWith("}}")).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("returns {{}} for invalid/empty options", () => {
    expect(formatTokenLabel(null)).toBe("{{}}");
    expect(formatTokenLabel(undefined)).toBe("{{}}");
    expect(formatTokenLabel({})).toBe("{{}}");
    expect(formatTokenLabel({ value: "", label: "" })).toBe("{{}}");
  });
});

// ============================================================================
// Property 5: Relation token generation with path normalization
// ============================================================================

describe("Property 5: Relation token generation with path normalization", () => {
  /**
   * Validates: Requirements 9.1, 9.4
   *
   * For any variable name string representing a singular relation, the token
   * generation function SHALL produce output in the format `{{relation doc.<name>}}`,
   * automatically prepending "doc." if the input path does not already start with "doc.".
   */

  it("produces {{relation doc.<name>}} for names without doc. prefix", () => {
    fc.assert(
      fc.property(
        relationNameArb.filter((name) => !name.startsWith("doc.")),
        (name) => {
          const result = generateRelationToken(name);
          expect(result).toBe(`{{relation doc.${name}}}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does not double-prepend doc. when input already has doc. prefix", () => {
    fc.assert(
      fc.property(relationNameArb, (name) => {
        const inputWithDoc = `doc.${name}`;
        const result = generateRelationToken(inputWithDoc);

        // Should be {{relation doc.<name>}}, not {{relation doc.doc.<name>}}
        expect(result).toBe(`{{relation doc.${name}}}`);
        expect(result).not.toContain("doc.doc.");
      }),
      { numRuns: 100 },
    );
  });

  it("always starts with {{relation doc. and ends with }}", () => {
    fc.assert(
      fc.property(relationNameArb, (name) => {
        const result = generateRelationToken(name);

        expect(result.startsWith("{{relation doc.")).toBe(true);
        expect(result.endsWith("}}")).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("handles names with dots (nested paths) correctly", () => {
    fc.assert(
      fc.property(
        fc
          .array(fieldNameSegmentArb, { minLength: 2, maxLength: 4 })
          .map((segs) => segs.join(".")),
        (nestedName) => {
          const result = generateRelationToken(nestedName);
          expect(result).toBe(`{{relation doc.${nestedName}}}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns {{relation doc.}} for empty/invalid input", () => {
    expect(generateRelationToken("")).toBe("{{relation doc.}}");
    expect(generateRelationToken(null)).toBe("{{relation doc.}}");
    expect(generateRelationToken(undefined)).toBe("{{relation doc.}}");
    expect(generateRelationToken("   ")).toBe("{{relation doc.}}");
  });
});

// ============================================================================
// Property 6: Token display simplification
// ============================================================================

describe("Property 6: Token display simplification", () => {
  /**
   * Validates: Requirements 9.3, 12.1, 12.3, 15.5
   *
   * For any token string matching patterns `{{relation doc.<path>}}` or
   * `{{docInfo.<path>}}` or `{{doc.<path>}}`, the simplification function SHALL
   * produce a display string `{{<path>}}` with the prefix removed, correctly
   * handling nested dot-notation paths.
   */

  it("strips 'relation doc.' prefix from relation tokens", () => {
    fc.assert(
      fc.property(relationNameArb, (name) => {
        const token = `{{relation doc.${name}}}`;
        const result = simplifyTokenDisplay(token);

        expect(result).toBe(`{{${name}}}`);
      }),
      { numRuns: 100 },
    );
  });

  it("strips 'docInfo.' prefix from docInfo tokens", () => {
    fc.assert(
      fc.property(fieldNameSegmentArb, (fieldName) => {
        const token = `{{docInfo.${fieldName}}}`;
        const result = simplifyTokenDisplay(token);

        expect(result).toBe(`{{${fieldName}}}`);
      }),
      { numRuns: 100 },
    );
  });

  it("strips 'doc.' prefix from doc tokens", () => {
    fc.assert(
      fc.property(fieldNameSegmentArb, (fieldName) => {
        const token = `{{doc.${fieldName}}}`;
        const result = simplifyTokenDisplay(token);

        expect(result).toBe(`{{${fieldName}}}`);
      }),
      { numRuns: 100 },
    );
  });

  it("handles nested dot-notation paths in relation tokens", () => {
    fc.assert(
      fc.property(
        fc
          .array(fieldNameSegmentArb, { minLength: 2, maxLength: 4 })
          .map((segs) => segs.join(".")),
        (nestedPath) => {
          const token = `{{relation doc.${nestedPath}}}`;
          const result = simplifyTokenDisplay(token);

          // Should strip only "relation doc." and keep the rest
          expect(result).toBe(`{{${nestedPath}}}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("handles nested dot-notation paths in docInfo tokens", () => {
    fc.assert(
      fc.property(
        fc
          .array(fieldNameSegmentArb, { minLength: 2, maxLength: 3 })
          .map((segs) => segs.join(".")),
        (nestedPath) => {
          const token = `{{docInfo.${nestedPath}}}`;
          const result = simplifyTokenDisplay(token);

          expect(result).toBe(`{{${nestedPath}}}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns empty string for null/undefined input", () => {
    expect(simplifyTokenDisplay(null)).toBe("");
    expect(simplifyTokenDisplay(undefined)).toBe("");
    expect(simplifyTokenDisplay("")).toBe("");
  });

  it("returns token unchanged if no known prefix matches", () => {
    fc.assert(
      fc.property(fieldNameSegmentArb, (fieldName) => {
        const token = `{{${fieldName}}}`;
        const result = simplifyTokenDisplay(token);

        // No prefix to strip, should return as-is
        expect(result).toBe(token);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 10: DocInfo token generation
// ============================================================================

describe("Property 10: DocInfo token generation", () => {
  /**
   * Validates: Requirements 15.4
   *
   * For any docInfo field name, inserting it into the canvas SHALL produce a token
   * in the format `{{docInfo.<field_name>}}`.
   */

  it("produces {{docInfo.<field_name>}} for any valid field name", () => {
    fc.assert(
      fc.property(fieldNameSegmentArb, (fieldName) => {
        const result = generateDocInfoToken(fieldName);

        expect(result).toBe(`{{docInfo.${fieldName}}}`);
      }),
      { numRuns: 100 },
    );
  });

  it("always starts with {{docInfo. and ends with }}", () => {
    fc.assert(
      fc.property(fieldNameSegmentArb, (fieldName) => {
        const result = generateDocInfoToken(fieldName);

        expect(result.startsWith("{{docInfo.")).toBe(true);
        expect(result.endsWith("}}")).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("preserves the exact field name without modification", () => {
    fc.assert(
      fc.property(fieldNameSegmentArb, (fieldName) => {
        const result = generateDocInfoToken(fieldName);

        // Extract the field name from the result
        const extracted = result.slice("{{docInfo.".length, -"}}".length);
        expect(extracted).toBe(fieldName);
      }),
      { numRuns: 100 },
    );
  });

  it("trims whitespace from field names", () => {
    fc.assert(
      fc.property(fieldNameSegmentArb, (fieldName) => {
        const paddedName = `  ${fieldName}  `;
        const result = generateDocInfoToken(paddedName);

        expect(result).toBe(`{{docInfo.${fieldName}}}`);
      }),
      { numRuns: 100 },
    );
  });

  it("returns {{docInfo.}} for empty/invalid input", () => {
    expect(generateDocInfoToken("")).toBe("{{docInfo.}}");
    expect(generateDocInfoToken(null)).toBe("{{docInfo.}}");
    expect(generateDocInfoToken(undefined)).toBe("{{docInfo.}}");
    expect(generateDocInfoToken("   ")).toBe("{{docInfo.}}");
  });
});

// ============================================================================
// Property 7: RelationPath option filtering
// ============================================================================

describe("Property 7: RelationPath option filtering — marks relations as selectable and relation as non-selectable", () => {
  /**
   * Validates: Requirements 10.1, 10.2
   */

  it("all 'relations' nodes in output have disabled=false (selectable)", () => {
    fc.assert(
      fc.property(mixedRelationTreeArb, (options) => {
        const result = filterRelationPathOptions(options);
        const allNodes = collectAllNodes(result);

        const relationsNodes = allNodes.filter((n) => n.type === "relations");
        for (const node of relationsNodes) {
          expect(node.disabled).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("all 'relation' nodes in output have disabled=true (non-selectable)", () => {
    fc.assert(
      fc.property(mixedRelationTreeArb, (options) => {
        const result = filterRelationPathOptions(options);
        const allNodes = collectAllNodes(result);

        const relationNodes = allNodes.filter((n) => n.type === "relation");
        for (const node of relationNodes) {
          expect(node.disabled).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("output contains only 'relations' and 'relation' type nodes (no data/preferences)", () => {
    fc.assert(
      fc.property(mixedRelationTreeArb, (options) => {
        const result = filterRelationPathOptions(options);
        const allNodes = collectAllNodes(result);

        for (const node of allNodes) {
          expect(["relations", "relation"]).toContain(node.type);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("every 'relations' node in the input appears in the output with disabled=false", () => {
    fc.assert(
      fc.property(mixedRelationTreeArb, (options) => {
        const result = filterRelationPathOptions(options);
        const allOutputNodes = collectAllNodes(result);
        const outputValues = new Set(allOutputNodes.map((n) => n.value));

        function collectRelationsFromInput(nodes) {
          const found = [];
          for (const node of nodes) {
            if (node && node.type === "relations") {
              found.push(node.value);
            }
            if (node && Array.isArray(node.children)) {
              if (
                node.type === "relation" &&
                nodeHasRelationsDescendant(node)
              ) {
                found.push(...collectRelationsFromInput(node.children));
              }
            }
          }
          return found;
        }

        const inputRelationsValues = collectRelationsFromInput(options);
        for (const val of inputRelationsValues) {
          expect(outputValues.has(val)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 8: Relation node pruning hides nodes without relations descendants
// ============================================================================

describe("Property 8: Relation node pruning hides nodes without relations descendants", () => {
  /**
   * Validates: Requirements 10.4
   */

  it("relation nodes without any relations descendant are excluded from output", () => {
    fc.assert(
      fc.property(
        fc.array(relationWithoutRelationsChildArb, {
          minLength: 1,
          maxLength: 5,
        }),
        (options) => {
          const result = filterRelationPathOptions(options);
          expect(result).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("relation nodes WITH relations descendants are preserved in output", () => {
    fc.assert(
      fc.property(
        fc.array(relationWithRelationsChildArb, { minLength: 1, maxLength: 5 }),
        (options) => {
          const result = filterRelationPathOptions(options);
          expect(result.length).toBe(options.length);
          for (const node of result) {
            expect(node.type).toBe("relation");
            expect(node.disabled).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("mixed input: only relation nodes with relations descendants survive", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(relationWithRelationsChildArb, {
            minLength: 1,
            maxLength: 3,
          }),
          fc.array(relationWithoutRelationsChildArb, {
            minLength: 1,
            maxLength: 3,
          }),
        ),
        ([withDescendants, withoutDescendants]) => {
          const combined = [...withDescendants, ...withoutDescendants];
          const result = filterRelationPathOptions(combined);
          const allNodes = collectAllNodes(result);

          const prunedValues = new Set(withoutDescendants.map((n) => n.value));
          for (const node of allNodes) {
            if (node.type === "relation") {
              expect(prunedValues.has(node.value)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("deeply nested relation without relations at any depth is pruned", () => {
    fc.assert(
      fc.property(
        fc.record({
          label: fc.constantFrom("Parent", "Root", "Top"),
          value: fc.constantFrom("parent", "root", "top"),
          type: fc.constant("relation"),
          children: fc.array(
            fc.record({
              label: fc.constantFrom("Mid", "Inner", "Sub"),
              value: fc.constantFrom("parent.mid", "root.inner", "top.sub"),
              type: fc.constant("relation"),
              children: fc.array(dataLeafArb, { minLength: 0, maxLength: 2 }),
            }),
            { minLength: 0, maxLength: 3 },
          ),
        }),
        (deepRelationWithoutRelations) => {
          const result = filterRelationPathOptions([
            deepRelationWithoutRelations,
          ]);
          expect(result).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 9: Nested relation full path construction
// ============================================================================

describe("Property 9: Nested relation full path construction", () => {
  /**
   * Validates: Requirements 10.5
   */

  it("nested relations items have full dot-notation path including ancestor relation names", () => {
    fc.assert(
      fc.property(deepNestedRelationArb, (deepNode) => {
        const result = filterRelationPathOptions([deepNode]);

        expect(result.length).toBe(1);
        const outerNode = result[0];
        expect(outerNode.type).toBe("relation");
        expect(outerNode.disabled).toBe(true);

        expect(outerNode.children.length).toBe(1);
        const innerNode = outerNode.children[0];
        expect(innerNode.type).toBe("relation");
        expect(innerNode.disabled).toBe(true);

        expect(innerNode.children.length).toBe(1);
        const relationsNode = innerNode.children[0];
        expect(relationsNode.type).toBe("relations");
        expect(relationsNode.disabled).toBe(false);

        // The value should contain the full dot-notation path
        const pathParts = relationsNode.value.split(".");
        expect(pathParts.length).toBe(3);
        expect(pathParts[0]).toBe(outerNode.value);
      }),
      { numRuns: 100 },
    );
  });

  it("relations node value preserves full path from buildTreeOptions input", () => {
    fc.assert(
      fc.property(
        fc.record({
          outerName: fc.constantFrom("branch", "customer", "supplier"),
          innerName: fc.constantFrom("department", "division", "unit"),
          relationsName: fc.constantFrom("items", "orders", "employees"),
        }),
        ({ outerName, innerName, relationsName }) => {
          const expectedPath = `${outerName}.${innerName}.${relationsName}`;
          const input = [
            {
              label: outerName,
              value: outerName,
              type: "relation",
              children: [
                {
                  label: innerName,
                  value: `${outerName}.${innerName}`,
                  type: "relation",
                  children: [
                    {
                      label: relationsName,
                      value: expectedPath,
                      type: "relations",
                      children: [],
                    },
                  ],
                },
              ],
            },
          ];

          const result = filterRelationPathOptions(input);
          const allNodes = collectAllNodes(result);
          const relationsNodes = allNodes.filter((n) => n.type === "relations");

          expect(relationsNodes.length).toBe(1);
          expect(relationsNodes[0].value).toBe(expectedPath);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("single-level relations (no nesting) preserves simple path", () => {
    fc.assert(
      fc.property(relationsLeafArb, (relationsNode) => {
        const result = filterRelationPathOptions([relationsNode]);

        expect(result.length).toBe(1);
        expect(result[0].value).toBe(relationsNode.value);
        expect(result[0].disabled).toBe(false);
        expect(result[0].children).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("multiple nested relations under same parent each preserve their full paths", () => {
    fc.assert(
      fc.property(
        fc.record({
          parentName: fc.constantFrom("branch", "customer", "supplier"),
          childNames: fc.uniqueArray(
            fc.constantFrom("items", "orders", "invoices", "payments"),
            { minLength: 2, maxLength: 4 },
          ),
        }),
        ({ parentName, childNames }) => {
          const input = [
            {
              label: parentName,
              value: parentName,
              type: "relation",
              children: childNames.map((name) => ({
                label: name,
                value: `${parentName}.${name}`,
                type: "relations",
                children: [],
              })),
            },
          ];

          const result = filterRelationPathOptions(input);
          expect(result.length).toBe(1);

          const parentNode = result[0];
          expect(parentNode.type).toBe("relation");
          expect(parentNode.children.length).toBe(childNames.length);

          for (let i = 0; i < childNames.length; i++) {
            const child = parentNode.children[i];
            expect(child.type).toBe("relations");
            expect(child.value).toBe(`${parentName}.${childNames[i]}`);
            expect(child.disabled).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 4: Token option filtering excludes relations and their children
// ============================================================================

import { filterTokenOptions } from "./tokenConfigHelpers";

/**
 * Property-Based Tests for tokenConfigHelpers.js
 * Property 4: Token option filtering excludes relations and their children
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 *
 * For any `dataTableColumns` tree containing nodes of type "relations", the
 * `filterTokenOptions` function SHALL exclude all nodes with `type === "relations"`
 * AND all descendant nodes nested under those "relations" nodes, while retaining
 * all nodes of type "data", "preferences", and "relation" (singular).
 */

// --- Arbitraries for filterTokenOptions ---

/**
 * Generate a "data" type leaf node.
 */
const tokenDataLeafArb = fc.record({
  label: fc.constantFrom("Name", "Code", "Date", "Amount", "Price", "Qty"),
  value: fc.constantFrom("name", "code", "date", "amount", "price", "qty"),
  type: fc.constant("data"),
  children: fc.constant([]),
});

/**
 * Generate a "preferences" type leaf node.
 */
const tokenPreferencesLeafArb = fc.record({
  label: fc.constantFrom("Company Name", "Logo", "Address", "Phone", "Email"),
  value: fc.constantFrom("company_name", "logo", "address", "phone", "email"),
  type: fc.constant("preferences"),
  children: fc.constant([]),
});

/**
 * Generate a "relation" (singular) type node with data children.
 */
const tokenRelationNodeArb = fc
  .record({
    label: fc.constantFrom("Branch", "Customer", "Supplier", "Warehouse"),
    value: fc.constantFrom("branch", "customer", "supplier", "warehouse"),
    children: fc.array(
      fc.record({
        label: fc.constantFrom("Name", "Code", "Address", "Phone"),
        value: fc.constantFrom("name", "code", "address", "phone"),
        type: fc.constant("data"),
        children: fc.constant([]),
      }),
      { minLength: 0, maxLength: 3 },
    ),
  })
  .map((node) => ({
    ...node,
    type: "relation",
    children: node.children.map((child) => ({
      ...child,
      value: `${node.value}.${child.value}`,
    })),
  }));

/**
 * Generate a "relations" (many) type node with nested children that should be excluded.
 */
const tokenRelationsNodeArb = fc
  .record({
    label: fc.constantFrom("Items", "Orders", "Invoices", "Payments", "Lines"),
    value: fc.constantFrom("items", "orders", "invoices", "payments", "lines"),
    children: fc.array(
      fc.record({
        label: fc.constantFrom("Qty", "Price", "Total", "Discount", "Tax"),
        value: fc.constantFrom("qty", "price", "total", "discount", "tax"),
        type: fc.constant("data"),
        children: fc.constant([]),
      }),
      { minLength: 1, maxLength: 4 },
    ),
  })
  .map((node) => ({
    ...node,
    type: "relations",
    children: node.children.map((child) => ({
      ...child,
      value: `${node.value}.${child.value}`,
    })),
  }));

/**
 * Generate a "relations" node with deeply nested children (relations → relation → data).
 */
const tokenDeepRelationsNodeArb = fc
  .record({
    label: fc.constantFrom("Items", "Orders", "Lines"),
    value: fc.constantFrom("items", "orders", "lines"),
    innerRelation: fc.record({
      label: fc.constantFrom("Product", "Category"),
      value: fc.constantFrom("product", "category"),
    }),
    leafChildren: fc.array(
      fc.record({
        label: fc.constantFrom("Name", "SKU", "Price"),
        value: fc.constantFrom("name", "sku", "price"),
        type: fc.constant("data"),
        children: fc.constant([]),
      }),
      { minLength: 1, maxLength: 3 },
    ),
  })
  .map(({ label, value, innerRelation, leafChildren }) => ({
    label,
    value,
    type: "relations",
    children: [
      {
        label: innerRelation.label,
        value: `${value}.${innerRelation.value}`,
        type: "relation",
        children: leafChildren.map((child) => ({
          ...child,
          value: `${value}.${innerRelation.value}.${child.value}`,
        })),
      },
    ],
  }));

/**
 * Generate a mixed tree with all node types for comprehensive testing.
 */
const tokenMixedTreeArb = fc.array(
  fc.oneof(
    { arbitrary: tokenDataLeafArb, weight: 3 },
    { arbitrary: tokenPreferencesLeafArb, weight: 2 },
    { arbitrary: tokenRelationNodeArb, weight: 3 },
    { arbitrary: tokenRelationsNodeArb, weight: 3 },
    { arbitrary: tokenDeepRelationsNodeArb, weight: 1 },
  ),
  { minLength: 1, maxLength: 8 },
);

/**
 * Generate a tree that contains ONLY "relations" nodes (all should be excluded).
 */
const tokenOnlyRelationsTreeArb = fc.array(tokenRelationsNodeArb, {
  minLength: 1,
  maxLength: 5,
});

/**
 * Generate a tree that contains NO "relations" nodes (all should be retained).
 */
const tokenNoRelationsTreeArb = fc.array(
  fc.oneof(
    { arbitrary: tokenDataLeafArb, weight: 3 },
    { arbitrary: tokenPreferencesLeafArb, weight: 2 },
    { arbitrary: tokenRelationNodeArb, weight: 2 },
  ),
  { minLength: 1, maxLength: 6 },
);

// --- Helper functions for Property 4 verification ---

/**
 * Collect all nodes from a tree (flattened) for inspection.
 * @param {Array} tree - Tree-structured nodes to flatten
 * @returns {Array} Flattened array of all nodes
 */
function collectAllFilteredNodes(tree) {
  const nodes = [];
  for (const node of tree) {
    nodes.push(node);
    if (Array.isArray(node.children) && node.children.length > 0) {
      nodes.push(...collectAllFilteredNodes(node.children));
    }
  }
  return nodes;
}

/**
 * Collect all non-relations nodes from input that are NOT descendants of a "relations" node.
 * These are the nodes that SHOULD appear in the output.
 * @param {Array} tree - Tree-structured nodes to inspect
 * @returns {Array} Values of nodes expected to be retained
 */
function collectExpectedRetainedNodes(tree) {
  const retained = [];
  for (const node of tree) {
    if (node.type === "relations") {
      // Skip this node and all its descendants
      continue;
    }
    retained.push(node.value);
    if (Array.isArray(node.children) && node.children.length > 0) {
      retained.push(...collectExpectedRetainedNodes(node.children));
    }
  }
  return retained;
}

/**
 * Collect all nodes that are descendants of "relations" nodes in the input.
 * These should NOT appear in the output.
 * @param {Array} tree - Tree-structured nodes to inspect
 * @returns {Array} Values of nodes that are descendants of "relations" nodes
 */
function collectRelationsDescendants(tree) {
  const descendants = [];
  for (const node of tree) {
    if (node.type === "relations" && Array.isArray(node.children)) {
      // All children of a "relations" node are descendants to exclude
      function collectAll(nodes) {
        for (const n of nodes) {
          descendants.push(n.value);
          if (Array.isArray(n.children) && n.children.length > 0) {
            collectAll(n.children);
          }
        }
      }
      collectAll(node.children);
    } else if (Array.isArray(node.children)) {
      descendants.push(...collectRelationsDescendants(node.children));
    }
  }
  return descendants;
}

// --- Property 4 Tests ---

describe("Property 4: Token option filtering excludes relations and their children", () => {
  /**
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4
   */

  it("no node in the output has type 'relations'", () => {
    fc.assert(
      fc.property(tokenMixedTreeArb, (options) => {
        const result = filterTokenOptions(options);
        const allNodes = collectAllFilteredNodes(result);

        for (const node of allNodes) {
          expect(node.type).not.toBe("relations");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("all nodes of type 'data', 'preferences', and 'relation' from input are present in output (unless descendants of relations)", () => {
    fc.assert(
      fc.property(tokenMixedTreeArb, (options) => {
        const result = filterTokenOptions(options);
        const outputValues = new Set(
          collectAllFilteredNodes(result).map((n) => n.value),
        );
        const expectedRetained = collectExpectedRetainedNodes(options);

        for (const value of expectedRetained) {
          expect(outputValues.has(value)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("descendants of 'relations' nodes are excluded from output", () => {
    fc.assert(
      fc.property(tokenMixedTreeArb, (options) => {
        const result = filterTokenOptions(options);
        const outputValues = new Set(
          collectAllFilteredNodes(result).map((n) => n.value),
        );
        const relationsDescendants = collectRelationsDescendants(options);

        for (const value of relationsDescendants) {
          expect(outputValues.has(value)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("output is empty when input contains only 'relations' nodes", () => {
    fc.assert(
      fc.property(tokenOnlyRelationsTreeArb, (options) => {
        const result = filterTokenOptions(options);
        expect(result).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("output preserves all nodes when input contains no 'relations' nodes", () => {
    fc.assert(
      fc.property(tokenNoRelationsTreeArb, (options) => {
        const result = filterTokenOptions(options);
        const inputNodeCount = collectAllFilteredNodes(options).length;
        const outputNodeCount = collectAllFilteredNodes(result).length;

        expect(outputNodeCount).toBe(inputNodeCount);
      }),
      { numRuns: 100 },
    );
  });

  it("retained nodes preserve their type correctly (data, preferences, relation)", () => {
    fc.assert(
      fc.property(tokenMixedTreeArb, (options) => {
        const result = filterTokenOptions(options);
        const allNodes = collectAllFilteredNodes(result);

        for (const node of allNodes) {
          expect(["data", "preferences", "relation"]).toContain(node.type);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("children of retained nodes are recursively filtered (no relations at any depth)", () => {
    fc.assert(
      fc.property(tokenMixedTreeArb, (options) => {
        const result = filterTokenOptions(options);

        function verifyNoRelationsAtAnyDepth(nodes) {
          for (const node of nodes) {
            expect(node.type).not.toBe("relations");
            if (Array.isArray(node.children) && node.children.length > 0) {
              verifyNoRelationsAtAnyDepth(node.children);
            }
          }
        }

        verifyNoRelationsAtAnyDepth(result);
      }),
      { numRuns: 100 },
    );
  });

  it("returns empty array for empty/invalid input", () => {
    expect(filterTokenOptions([])).toEqual([]);
    expect(filterTokenOptions(null)).toEqual([]);
    expect(filterTokenOptions(undefined)).toEqual([]);
  });
});

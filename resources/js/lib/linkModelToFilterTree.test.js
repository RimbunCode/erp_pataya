/**
 * Unit tests untuk linkModelToFilterTree / filterTreeToLinkModel.
 * Task 5.4 (spec linkmodel-filter-converter).
 *
 * Tests:
 * - Pemetaan operator LinkModel → FilterEvaluator (not→!=, like→matches, dst)
 * - Kolom date/datetime → in_period berbentuk DateSelector
 * - Relasi nested-object → flatten dot-notation
 * - INVARIAN renderability: tiap item.o ∈ getOperators(type) (operators.js)
 * - Round-trip link → tree → link setara
 *
 * Validates: Requirements 6.6, 8.5
 * Feature: linkmodel-filter-converter
 */

import { describe, it, expect } from "vitest";
import {
  linkModelToFilterTree,
  filterTreeToLinkModel,
} from "./linkModelToFilterTree";
import { getOperators } from "../Components/Table/Filter/operators";

// Metadata kolom mock — bentuk getColumns() (keyed by name, punya `type`).
const columns = {
  status: { name: "status", type: "string" },
  qty: { name: "qty", type: "number" },
  created_at: { name: "created_at", type: "datetime" },
  born_on: { name: "born_on", type: "date" },
  formStatuses: { name: "formStatuses", type: "formStatuses" },
  category: {
    name: "category",
    type: "relation",
    typeRelation: "basic",
    columns: {
      type: { name: "type", type: "string" },
    },
  },
};

// Kumpulkan semua item {k,o,v} dari tree (lewati group).
const collectItems = (tree) => {
  const items = [];
  const walk = (node) => {
    if (!node) return;
    if (node.c !== undefined && (node.k === "and" || node.k === "or")) {
      Object.values(node.c).forEach(walk);
      return;
    }
    if (node.k && node.o) items.push(node);
  };
  walk(tree.root);
  return items;
};

describe("linkModelToFilterTree — pemetaan operator", () => {
  it("scalar shorthand → operator '='", () => {
    const tree = linkModelToFilterTree({ status: "submitted" }, columns);
    const items = collectItems(tree);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ k: "status", o: "=", v: "submitted" });
  });

  it("not → '!=', like → 'matches'", () => {
    const tree = linkModelToFilterTree(
      { status: { not: "x" }, status2: { like: "wo" } },
      { ...columns, status2: { name: "status2", type: "string" } },
    );
    const ops = collectItems(tree).map((i) => i.o);
    expect(ops).toContain("!=");
    expect(ops).toContain("matches");
  });

  it("notIn → '!in', notBetween → '!between' (number)", () => {
    const tree = linkModelToFilterTree(
      { qty: { notIn: [1, 2] }, qty2: { notBetween: [1, 9] } },
      { ...columns, qty2: { name: "qty2", type: "number" } },
    );
    const ops = collectItems(tree).map((i) => i.o);
    expect(ops).toContain("!in");
    expect(ops).toContain("!between");
  });
});

describe("linkModelToFilterTree — date → in_period", () => {
  it("'>' pada date → in_period / after, value period DateSelector", () => {
    const tree = linkModelToFilterTree(
      { born_on: { ">": "2024-01-01" } },
      columns,
    );
    const [item] = collectItems(tree);
    expect(item.o).toBe("in_period");
    expect(item.v).toMatchObject({
      period: "day",
      operator: "after",
      startDate: "2024-01-01",
    });
  });

  it("between pada date → in_period / between (startDate+endDate)", () => {
    const tree = linkModelToFilterTree(
      { born_on: { between: ["2024-01-01", "2024-12-31"] } },
      columns,
    );
    const [item] = collectItems(tree);
    expect(item.o).toBe("in_period");
    expect(item.v).toMatchObject({
      period: "day",
      operator: "between",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
  });

  it("not pada date → !in_period", () => {
    const tree = linkModelToFilterTree(
      { created_at: { not: "2024-01-01" } },
      columns,
    );
    const [item] = collectItems(tree);
    expect(item.o).toBe("!in_period");
  });
});

describe("linkModelToFilterTree — relasi & formStatuses", () => {
  it("relasi nested-object → flatten ke dot-notation", () => {
    const tree = linkModelToFilterTree({ category: { type: "x" } }, columns);
    const [item] = collectItems(tree);
    expect(item.k).toBe("category.type");
    expect(item.o).toBe("=");
  });

  it("jsonContains pada formStatuses → 'has'", () => {
    const tree = linkModelToFilterTree(
      { formStatuses: { jsonContains: ["draft"] } },
      columns,
    );
    const [item] = collectItems(tree);
    expect(item.o).toBe("has");
  });
});

describe("INVARIAN renderability — item.o ∈ getOperators(type)", () => {
  it("setiap item memakai operator yang ada di getOperators(type)", () => {
    const tree = linkModelToFilterTree(
      {
        status: { like: "a" },
        qty: { ">": 1, notBetween: [1, 9] },
        born_on: { ">": "2024-01-01" },
        created_at: { not: "2024-01-01" },
        formStatuses: { jsonContains: ["draft"] },
        category: { type: "x" },
      },
      columns,
    );
    const resolveType = (k) => {
      if (k.includes(".")) return columns.category.columns.type.type; // category.type → string
      return columns[k]?.type ?? "string";
    };
    for (const item of collectItems(tree)) {
      const type = resolveType(item.k);
      const allowed = Object.keys(getOperators(type));
      expect(allowed).toContain(item.o);
    }
  });
});

describe("round-trip link → tree → link", () => {
  it("operator dengan padanan dua arah setara", () => {
    const link = {
      status: "submitted",
      qty: { ">": 5 },
      born_on: { ">": "2024-01-01" },
    };
    const back = filterTreeToLinkModel(linkModelToFilterTree(link, columns));
    expect(back.status).toBe("submitted");
    expect(back.qty).toMatchObject({ ">": 5 });
    expect(back.born_on).toMatchObject({ ">": "2024-01-01" });
  });
});

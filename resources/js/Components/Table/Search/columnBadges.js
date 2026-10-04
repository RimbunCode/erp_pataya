// columnBadges — fungsi murni: turunkan Badge Nilai per kolom dari chip draft
// (`treeToChips`) untuk Sel Filter (spec datatable2-column-search-row,
// Requirement 5.1-5.2, 8.1-8.2, 8.5, 8.7). Badge BUKAN state: selalu turunan
// dari tree yang sama dengan chip Search Bar atas.

import { leafValueBadges } from "./searchChips";
import { resolveColumnPath } from "./columnSearch";
import { canEditLeafInCell } from "./valueInputUtils";

/**
 * Apakah kunci leaf `k` milik `column`: `k === name`, atau (kolom relasi)
 * `k` bertitik di bawah relasi itu (mis. `category.name` utk `category`).
 * @param {string} k kunci leaf
 * @param {{name?: string, type?: string}} column
 * @returns {boolean}
 */
export const leafBelongsToColumn = (k, column) => {
  const name = column?.name;
  if (!name || typeof k !== "string") return false;
  if (k === name) return true;
  return column.type === "relation" && k.startsWith(`${name}.`);
};

/**
 * Badge nilai untuk SATU kolom. Hanya chip `leaf` (anak langsung root AND)
 * yang menghasilkan badge; chip `search`/`advanced` tidak.
 * @param {Array<{id: string, kind: string, node: object, label: string}>} chips
 *   hasil `treeToChips`
 * @param {object} column
 * @param {{t: (key: string) => string, columns: object, monthsShort?: string[]}} ctx
 * @returns {Array<{
 *   key: string, leafId: string, valueKey: string, label: string,
 *   tooltip: string, negated: boolean, op: string,
 *   editable: "edit"|"dotted"|"builder",
 * }>}
 */
export const badgesForColumn = (chips, column, ctx) => {
  const badges = [];
  for (const chip of chips) {
    if (chip.kind !== "leaf") continue;
    if (!leafBelongsToColumn(chip.node?.k, column)) continue;
    // Kolom aktual leaf (anak relasi bertitik ter-resolve ke kolom anaknya);
    // tak ter-resolve -> kolom sel (label nilai tetap terbentuk).
    const resolved = resolveColumnPath(ctx.columns, chip.node.k);
    const editable = canEditLeafInCell(resolved, chip.node);
    leafValueBadges(chip.node, resolved ?? column, ctx.t, {
      monthsShort: ctx.monthsShort,
    }).forEach((badge) =>
      badges.push({
        ...badge,
        key: `${chip.id}:${badge.valueKey}`,
        leafId: chip.id,
        tooltip: chip.label,
        editable,
      }),
    );
  }
  return badges;
};

/**
 * Kunci kolom yang dipakai di dalam chip `advanced` (leaf di grup / root OR
 * multi-kondisi) -- penanda "juga dipakai di filter lanjutan" pada sel
 * (Requirement 8.2). Chip Cari (`search`) sengaja TIDAK dihitung: ia mencakup
 * banyak kolom dan akan menandai hampir semua sel.
 * @param {Array<{kind: string, node: object}>} chips
 * @returns {Set<string>}
 */
export const columnsUsedInAdvanced = (chips) => {
  const used = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    const children = node.c ?? node.children;
    if (children && typeof children === "object") {
      Object.values(children).forEach(walk);
    } else if (typeof node.k === "string") {
      used.add(node.k);
    }
  };
  chips.forEach((chip) => {
    if (chip.kind === "advanced") walk(chip.node);
  });
  return used;
};

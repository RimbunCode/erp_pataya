/**
 * Konstanta CSS Grid untuk layout variabel di canvas editor.
 * Digunakan oleh Editor.jsx dan VariableItem.jsx untuk memastikan
 * konsistensi class dan style grid di seluruh modul PrintTemplate.
 * @module gridConstants
 */

/** @type {string} Nama class CSS untuk container grid utama */
export const GRID_CLASS = "gjs-grid";

/** @type {string} Nama class CSS untuk sub-grid (baris variabel) */
export const SUBGRID_CLASS = "gjs-subgrid";

/** @type {Readonly<object>} Style CSS untuk container grid utama */
export const GRID_RULE_STYLE = Object.freeze({
  display: "grid",
  "grid-template-columns": "max-content 1fr",
  "column-gap": "12px",
  "padding-top": "10px",
  "padding-bottom": "10px",
});

/** @type {Readonly<object>} Style CSS untuk sub-grid (baris variabel) */
export const SUBGRID_RULE_STYLE = Object.freeze({
  display: "grid",
  "grid-template-columns": "subgrid",
  gap: "8px",
  "grid-column": "1 / -1",
  padding: "0px",
});

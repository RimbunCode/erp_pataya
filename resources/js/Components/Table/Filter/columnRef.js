// Helper mode column (bandingkan kolom dgn kolom lain). Selaras dengan backend
// App\Services\Core\FilterEvaluator::isTypeCompatible & FilterTreeCleaner.
//
// Value mode column berbentuk: { kind: "column", ref: <string | string[]> }.

/**
 * Kategori type untuk cek kompatibilitas kiri↔kanan. Dua kolom hanya bisa
 * dibandingkan bila kategorinya sama.
 * @param {string} type
 * @returns {string}
 */
const columnTypeCategory = (type) => {
  switch (type) {
    case "number":
    case "currency":
      return "numeric";
    case "date":
    case "datetime":
      return "date";
    case "relation":
    case "relations":
      return "relation";
    case "formStatus":
    case "formStatuses":
      return "status";
    default:
      return type;
  }
};

/**
 * Apakah value sebuah item dalam mode column (column-ref).
 * @param value
 */
const isColumnRef = (value) =>
  Boolean(value) && typeof value === "object" && value.kind === "column";

/**
 * Bungkus ref menjadi value column-ref.
 * @param ref
 */
const makeColumnRef = (ref) => ({ kind: "column", ref });

export { columnTypeCategory, isColumnRef, makeColumnRef };

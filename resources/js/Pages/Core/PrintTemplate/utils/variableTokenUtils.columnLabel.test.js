import { describe, expect, it } from "vitest";
import { resolveLabel, resolveLabelWithMeta } from "./variableTokenUtils";

const MODEL = "App\Models\Purchase\PurchaseOrder";

const buildColumns = (col) => ({
  [MODEL]: { quantity: col },
});

/**
 * Meniru laravel-react-i18n: kunci yang tidak ada dikembalikan apa adanya.
 * @param {Record<string, string>} dict
 * @returns {(key: string) => string}
 */
const makeT = (dict) => (key) => dict[key] ?? key;

describe("resolveLabel: label kolom hasil terjemahan", () => {
  it("memakai terjemahan saat titleTrans ketemu di dictionary", () => {
    const t = makeT({ "purchase.purchaseOrder.columns.quantity": "Kuantitas" });
    const columns = buildColumns({
      name: "quantity",
      titleTrans: "purchase.purchaseOrder.columns.quantity",
    });

    expect(resolveLabel("doc.quantity", columns, MODEL, t)).toBe("Kuantitas");
  });

  it("jatuh ke col.name saat terjemahan gagal (library mengembalikan kunci)", () => {
    const t = makeT({});
    const columns = buildColumns({
      name: "quantity",
      titleTrans: "purchase.purchaseOrder.item.columns.quantity",
    });

    expect(resolveLabel("doc.quantity", columns, MODEL, t)).toBe("quantity");
  });

  it("jatuh ke col.name saat terjemahan kosong atau null", () => {
    const columns = buildColumns({
      name: "quantity",
      titleTrans: "some.missing.key",
    });

    expect(resolveLabel("doc.quantity", columns, MODEL, () => "")).toBe(
      "quantity",
    );
    expect(resolveLabel("doc.quantity", columns, MODEL, () => null)).toBe(
      "quantity",
    );
  });

  it("col.title tetap paling diprioritaskan, walau titleTrans bisa diterjemahkan", () => {
    const t = makeT({ "a.b": "Terjemahan" });
    const columns = buildColumns({
      name: "quantity",
      title: "Judul Langsung",
      titleTrans: "a.b",
    });

    expect(resolveLabel("doc.quantity", columns, MODEL, t)).toBe(
      "Judul Langsung",
    );
  });

  it("memakai name saat t bukan fungsi", () => {
    const columns = buildColumns({ name: "quantity", titleTrans: "a.b" });

    expect(resolveLabel("doc.quantity", columns, MODEL, undefined)).toBe(
      "quantity",
    );
  });

  it("tanpa name, kunci yang gagal diterjemahkan tetap dikembalikan sebagai pilihan terakhir", () => {
    const columns = buildColumns({ titleTrans: "a.b" });

    expect(resolveLabel("doc.quantity", columns, MODEL, makeT({}))).toBe("a.b");
  });

  it("resolveLabelWithMeta tetap menyertakan titleTrans meski label jatuh ke name", () => {
    const columns = buildColumns({ name: "quantity", titleTrans: "a.b" });

    expect(
      resolveLabelWithMeta("doc.quantity", columns, MODEL, makeT({})),
    ).toEqual({ label: "quantity", titleTrans: "a.b" });
  });
});

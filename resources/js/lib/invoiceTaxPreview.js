/**
 * Pratinjau pajak baris invoice di form Sales/Purchase Invoice (pajak majemuk per item, spek
 * finance-multi-tax-per-item, Requirement 10.2). Angka yang disimpan dihitung `TaxEngine` di server; ini hanya
 * pratinjau sebelum simpan, memakai rumus yang sama dengan `DocumentDiscountCalculator::allocate` (lihat
 * `discountAllocation.js`) dan `InvoiceItemTaxCalculator` (agregat item).
 */
import { allocateDiscount } from "./discountAllocation";
import { dppSourceOf } from "./taxRules";

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Baris masukan `allocateDiscount`. Baris dengan 0 atau 1 pajak memakai bentuk satu pajak lama persis (hasil
 * identik dengan sebelum pajak majemuk); baris dengan 2 pajak atau lebih membawa `taxes`.
 * @param {number} basicAmount nilai kotor baris (jumlah x harga)
 * @param {ReturnType<import("./taxRules").rulesOf>} entries
 * @returns {object}
 */
export function allocationLine(basicAmount, entries) {
  const rateOf = (entry) => entry.rule?.rate ?? entry.tax?.rate ?? 0;

  if (entries.length <= 1) {
    const entry = entries[0];

    return {
      basic_amount: basicAmount,
      tax_rate: entry ? rateOf(entry) : 0,
      dpp_factor: entry?.rule?.dppFactor ?? 1,
      additive: entry?.rule?.additive ?? true,
    };
  }

  return {
    basic_amount: basicAmount,
    tax_rate: 0,
    taxes: entries.map((entry) => ({
      rate: rateOf(entry),
      dpp_factor: entry.rule?.dppFactor ?? 1,
      additive: entry.rule?.additive ?? true,
    })),
  };
}

/**
 * Pratinjau SEMUA baris setelah alokasi diskon dokumen (satu kali alokasi).
 * @param {object} params
 * @param {number[]} params.grossAmounts nilai kotor semua baris tabel
 * @param {Array<ReturnType<import("./taxRules").rulesOf>>} params.entriesList pajak berversi tiap baris
 * @param {{on?: string|null, rate?: number, amount?: number, latestKey?: string}} params.discount diskon dokumen
 * @returns {Array<{discount_amount: number, dpp_amount: number, tax_amount: number, withholding_amount: number, net_amount: number, tax_lines: Array<{id: string, name: string, rate: number, additive: boolean, tax_amount: number}>}>}
 */
export function previewInvoiceLines({ grossAmounts, entriesList, discount }) {
  const lines = grossAmounts.map((gross, i) =>
    allocationLine(gross, entriesList[i] ?? []),
  );
  const allocated = allocateDiscount(
    lines,
    discount?.on,
    discount?.rate ?? 0,
    discount?.amount ?? 0,
    discount?.latestKey ?? "discount_rate",
  );

  return lines.map((line, index) => {
    const result = allocated[index];
    const net = result?.basic_amount ?? 0;
    const entries = entriesList[index] ?? [];

    const taxLines = entries.map((entry, i) => {
      const additive = entry.rule?.additive ?? true;
      const rate = line.taxes?.[i]?.rate ?? line.tax_rate ?? 0;

      return {
        id: entry.taxId,
        name: entry.tax?.name,
        rate,
        additive,
        tax_amount: entry.rule ? (net * entry.rule.dppFactor * rate) / 100 : 0,
      };
    });
    const withholding = taxLines
      .filter((taxLine) => !taxLine.additive)
      .reduce((sum, taxLine) => sum + taxLine.tax_amount, 0);
    const dppSource = dppSourceOf(entries);

    return {
      discount_amount: round2((grossAmounts[index] ?? 0) - net),
      dpp_amount: dppSource ? net * dppSource.rule.dppFactor : 0,
      tax_amount: result?.tax_amount ?? 0,
      withholding_amount: withholding,
      net_amount: net,
      tax_lines: taxLines,
    };
  });
}

/**
 * Pratinjau satu baris (indeks `index`) setelah alokasi diskon dokumen; lihat `previewInvoiceLines`.
 * @param {object} params
 * @param {number[]} params.grossAmounts
 * @param {Array<ReturnType<import("./taxRules").rulesOf>>} params.entriesList
 * @param {number} params.index
 * @param {object} params.discount
 * @returns {ReturnType<typeof previewInvoiceLines>[number]}
 */
export function previewInvoiceLine({
  grossAmounts,
  entriesList,
  index,
  discount,
}) {
  const previews = previewInvoiceLines({ grossAmounts, entriesList, discount });

  return previews[index] ?? previews[0];
}

/**
 * Ringkasan per pajak dari `tax_lines` seluruh baris (nama, tarif, jumlah).
 * @param {Array<{tax_lines?: Array<{id: string, name: string, rate: number, additive: boolean, tax_amount: number}>}>} items
 * @returns {Array<{id: string, name: string, rate: number, additive: boolean, tax_amount: number}>}
 */
export function summarizeTaxLines(items) {
  const byTax = new Map();
  (items ?? []).forEach((item) => {
    (item?.tax_lines ?? []).forEach((line) => {
      const key = `${line.id}|${line.rate}|${line.additive}`;
      const current = byTax.get(key);
      byTax.set(
        key,
        current
          ? { ...current, tax_amount: current.tax_amount + line.tax_amount }
          : { ...line },
      );
    });
  });

  return [...byTax.values()];
}

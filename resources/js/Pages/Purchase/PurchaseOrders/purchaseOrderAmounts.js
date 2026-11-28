import { calculateArray } from "@/lib/utils";
import { rulesOf } from "@/lib/taxRules";
import { previewInvoiceLines } from "@/lib/invoiceTaxPreview";

/**
 * Total Purchase Order (pratinjau). Pajak majemuk per item: tiap baris dihitung dari semua pajaknya
 * (faktor DPP versi aturan, pajak potong tidak menambah total), mengikuti TaxEngine di server.
 * @param {object} data
 * @param {object[]} [taxRuleVersions] versi aturan pajak dari props halaman
 * @returns {{rawNetAmount: number, rawTaxAmount: number, net_amount: number, tax_amount: number, withholding_amount: number, amount: number, previews: object[]}}
 */
export function calculatePurchaseOrderAmounts(data, taxRuleVersions = []) {
  const filled = (data.items ?? []).filter((item) => item?.item);
  const entriesList = filled.map((item) =>
    rulesOf(item, taxRuleVersions, data.date),
  );
  const grossAmounts = filled.map(
    (item) => (item.quantity ?? 0) * (item.rate ?? 0),
  );
  const rawNetAmount = grossAmounts.reduce((sum, value) => sum + value, 0);
  const rawTaxAmount = previewInvoiceLines({
    grossAmounts,
    entriesList,
    discount: { on: null },
  }).reduce((sum, line) => sum + line.tax_amount, 0);
  const previews = previewInvoiceLines({
    grossAmounts,
    entriesList,
    discount: {
      on: data.discount_on,
      rate: data.discount_rate ?? 0,
      amount: data.discount_amount ?? 0,
      latestKey: data.latestDiscountKey ?? "discount_rate",
    },
  });
  const net_amount = calculateArray(previews, "net_amount", "+");
  const tax_amount = calculateArray(previews, "tax_amount", "+");
  const withholding_amount = calculateArray(
    previews,
    "withholding_amount",
    "+",
  );

  return {
    rawNetAmount,
    rawTaxAmount,
    net_amount,
    tax_amount,
    withholding_amount,
    amount: net_amount + tax_amount,
    previews,
  };
}

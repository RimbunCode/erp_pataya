/**
 * Replikasi persis App\Services\Finances\DocumentDiscountCalculator (PHP) --
 * lihat spec dpp-discount-and-tax-compliance/design.md. FE dan BE harus
 * menjalankan algoritma yang identik (termasuk aturan rounding) supaya nilai
 * yang di-preview di form sebelum save sama dengan nilai yang di-persist,
 * bukan dua algoritma berbeda yang kebetulan cocok.
 */

export const BASIS_NET_TOTAL = "net_total";
export const BASIS_GRAND_TOTAL = "grand_total";

function roundWithResidual(values) {
  if (values.length === 0) return [];

  const rounded = values.map((v) => Math.round(v * 100) / 100);
  const sumOriginal = values.reduce((a, b) => a + b, 0);
  const sumRounded = rounded.reduce((a, b) => a + b, 0);
  const residual = Math.round((sumOriginal - sumRounded) * 100) / 100;

  if (Math.abs(residual) >= 0.01) {
    let largestIndex = 0;
    let largestValue = values[0];
    values.forEach((v, i) => {
      if (v > largestValue) {
        largestValue = v;
        largestIndex = i;
      }
    });
    rounded[largestIndex] =
      Math.round((rounded[largestIndex] + residual) * 100) / 100;
  }

  return rounded;
}

function toResult(lines, basicAmounts, taxAmounts) {
  const roundedBasic = roundWithResidual(basicAmounts);
  const roundedTax = roundWithResidual(taxAmounts);

  return lines.map((_, i) => ({
    basic_amount: roundedBasic[i],
    tax_amount: roundedTax[i],
    amount: Math.round((roundedBasic[i] + roundedTax[i]) * 100) / 100,
  }));
}

/**
 * Alokasikan diskon dokumen pro-rata ke tiap baris, lalu hitung ulang tax_amount
 * dari basic_amount yang sudah dikurangi diskon (bukan lump-sum dari total akhir).
 * @param {Array<{basic_amount: number, tax_rate: number}>} lines
 * @param {string|null} discountOn 'net_total' | 'grand_total' | null (tanpa diskon)
 * @param {number} discountRate
 * @param {number} discountAmount
 * @param {string} latestDiscountKey 'discount_rate' | 'discount_amount' -- input mana yang otoritatif
 * @param {number|null} dppFactor null = pajak dihitung basic_amount*tax_rate/100 langsung (PO/SO).
 *                                Diisi (mis. 11/12) = pajak dihitung lewat basis DPP Nilai Lain:
 *                                (basic_amount*dppFactor)*tax_rate/100 (Purchase/Sales Invoice).
 * @returns {Array<{basic_amount: number, tax_amount: number, amount: number}>}
 */
export function allocateDiscount(
  lines,
  discountOn,
  discountRate,
  discountAmount,
  latestDiscountKey = "discount_rate",
  dppFactor = null,
) {
  if (!lines || lines.length === 0) return [];

  const taxBasisOf = (basicAmount) =>
    dppFactor === null ? basicAmount : basicAmount * dppFactor;

  const preTax = lines.map(
    (line) => (taxBasisOf(line.basic_amount) * line.tax_rate) / 100,
  );

  if (discountOn !== BASIS_NET_TOTAL && discountOn !== BASIS_GRAND_TOTAL) {
    return toResult(
      lines,
      lines.map((line) => line.basic_amount),
      preTax,
    );
  }

  const sumBasic = lines.reduce((a, line) => a + line.basic_amount, 0);
  const sumGross = sumBasic + preTax.reduce((a, b) => a + b, 0);
  const basis = discountOn === BASIS_NET_TOTAL ? sumBasic : sumGross;

  let discountValue =
    latestDiscountKey === "discount_amount"
      ? discountAmount
      : (basis * discountRate) / 100;

  if (basis > 0) {
    discountValue = Math.min(discountValue, basis);
  } else {
    discountValue = 0;
  }

  const newBasicAmounts = lines.map((line, i) => {
    if (discountOn === BASIS_NET_TOTAL) {
      const share = sumBasic > 0 ? line.basic_amount / sumBasic : 0;
      const allocated = discountValue * share;
      return Math.max(0, line.basic_amount - allocated);
    }
    const gross = line.basic_amount + preTax[i];
    const share = sumGross > 0 ? gross / sumGross : 0;
    const allocated = discountValue * share;
    const reduction = allocated / (1 + line.tax_rate / 100);
    return Math.max(0, line.basic_amount - reduction);
  });

  const newTaxAmounts = lines.map(
    (line, i) => (taxBasisOf(newBasicAmounts[i]) * line.tax_rate) / 100,
  );

  return toResult(lines, newBasicAmounts, newTaxAmounts);
}

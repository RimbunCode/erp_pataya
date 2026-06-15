const FALLBACK = Object.freeze({
  groupSeparator: ",",
  decimalSeparator: ".",
  decimalScale: 2,
});

/**
 * Mengurai pola number format seperti `#,###.##` menjadi bagian-bagiannya.
 *
 * Pola memakai bentuk `#<groupSeparator>###<decimalSeparator>##`, di mana
 * jumlah karakter `#`/`0` setelah decimalSeparator menentukan decimalScale.
 * @param {string} pattern contoh `#,###.##`, `#.###,##`, `#'###.##`, `#,###`
 * @returns {{ groupSeparator: string, decimalSeparator: string, decimalScale: number }}
 */
export function parseNumberFormat(pattern) {
  if (typeof pattern !== "string" || pattern.trim() === "") {
    return { ...FALLBACK };
  }

  const trimmed = pattern.trim();

  // Pola tanpa digit sama sekali dianggap invalid.
  if (!/[#0]/.test(trimmed)) {
    return { ...FALLBACK };
  }

  // Kumpulkan posisi semua pemisah (karakter non-#/0).
  const separators = [];
  for (let i = 0; i < trimmed.length; i++) {
    if (!/[#0]/.test(trimmed[i])) {
      separators.push({ char: trimmed[i], index: i });
    }
  }

  // Tanpa pemisah: integer murni, scale 0.
  if (separators.length === 0) {
    return { groupSeparator: "", decimalSeparator: ".", decimalScale: 0 };
  }

  const last = separators[separators.length - 1];
  const trailingDigits = trimmed.length - last.index - 1;

  // Pemisah terakhir adalah DECIMAL bila:
  //  - ada lebih dari satu pemisah (mis. #.###,## -> ',' decimal), ATAU
  //  - digit setelahnya bukan grup ribuan penuh 3 digit (#,###  -> ',' group, scale 0;
  //    #,###.## -> '.' decimal, scale 2; #.## -> '.' decimal, scale 2).
  const lastIsDecimal = separators.length > 1 || trailingDigits !== 3;

  if (lastIsDecimal) {
    const decimalSeparator = last.char;
    const decimalScale = trailingDigits;
    // Group separator: pemisah sebelum decimal (jika ada).
    const groupSeparator = separators.length > 1 ? separators[0].char : "";
    return { groupSeparator, decimalSeparator, decimalScale };
  }

  // Pemisah terakhir adalah GROUP separator; tidak ada bagian desimal.
  return { groupSeparator: last.char, decimalSeparator: ".", decimalScale: 0 };
}

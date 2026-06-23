import { parseNumberFormat } from "./parseNumberFormat";

/**
 * Membulatkan angka non-negatif ke sejumlah desimal dengan aturan round half-up,
 * tahan terhadap error floating point (mis. 1.005 -> 1.01).
 *
 * Memakai pergeseran titik desimal via notasi eksponen string agar pembulatan
 * dilakukan pada nilai yang benar, bukan representasi biner yang meleset.
 * @param {number} value nilai non-negatif
 * @param {number} scale jumlah desimal
 * @returns {string} string angka dengan tepat `scale` desimal
 */
function roundHalfUp(value, scale) {
  const shifted = Math.round(Number(`${value}e${scale}`));
  // Angka sangat besar membuat String(shifted) jadi notasi eksponen
  // (mis. "2.3e+20"), sehingga `${shifted}e-${scale}` menghasilkan eksponen
  // ganda -> NaN. Jika terjadi, fallback ke toFixed langsung.
  const result = Number(`${shifted}e-${scale}`);
  if (Number.isNaN(result)) {
    return Number(value).toFixed(scale);
  }
  return result.toFixed(scale);
}

/**
 * Memformat angka menjadi string display secara murni dan sinkron.
 *
 * Fungsi ini TIDAK mengenal currencyCode dan tidak melakukan I/O apa pun —
 * seluruh konfigurasi diberikan lewat options. Pembulatan `decimalScale`
 * memakai aturan round half-up matematis (`<5` ke bawah, `>=5` ke atas) dan
 * tahan terhadap error floating point (mis. `1.005 -> 1.01`). Nilai kosong,
 * `null`, `undefined`, atau `NaN` menghasilkan string kosong. Angka sangat
 * besar (di luar `Number.MAX_SAFE_INTEGER`) tetap diformat tanpa `NaN`, namun
 * presisinya mengikuti batas IEEE-754 double.
 *
 * Jika `numberFormat` diberikan, ia meng-override `groupSeparator`,
 * `decimalSeparator`, dan `decimalScale` (lihat {@link parseNumberFormat}).
 * @param {number|string} value nilai yang akan diformat
 * @param {object} [options] opsi format
 * @param {string} [options.numberFormat] pola seperti `#,###.##`; bila di-set, meng-override grp/dec/scale
 * @param {string} [options.groupSeparator] pemisah ribuan; default `,`
 * @param {string} [options.decimalSeparator] pemisah desimal; default `.`
 * @param {number} [options.decimalScale] jumlah desimal; bila `undefined`, desimal dipertahankan apa adanya
 * @param {string} [options.prefix] teks di depan angka; default `""`
 * @param {string} [options.suffix] teks di belakang angka; default `""`
 * @param {boolean} [options.allowNegativeValue] izinkan tanda minus; default `true`
 * @returns {string} string angka terformat (`""` bila value kosong/NaN)
 * @example
 * formatNumber(1234567.5, { decimalScale: 2 });               // "1,234,567.50"
 * formatNumber(1234567.891, { numberFormat: "#.###,##" });    // "1.234.567,89"
 * formatNumber(1000, { decimalScale: 2, prefix: "$" });       // "$1,000.00"
 * formatNumber(1.005, { decimalScale: 2 });                   // "1.01" (round half-up)
 */
export function formatNumber(value, options = {}) {
  let {
    numberFormat,
    groupSeparator = ",",
    decimalSeparator = ".",
    decimalScale,
    prefix = "",
    suffix = "",
    allowNegativeValue = true,
  } = options;

  if (numberFormat) {
    const parsed = parseNumberFormat(numberFormat);
    groupSeparator = parsed.groupSeparator;
    decimalSeparator = parsed.decimalSeparator;
    decimalScale = parsed.decimalScale;
  }

  const num = typeof value === "string" ? Number(value) : value;

  if (
    value === "" ||
    value === null ||
    value === undefined ||
    Number.isNaN(num)
  ) {
    return "";
  }

  const isNegative = num < 0 && allowNegativeValue;
  const absValue = Math.abs(num);

  // Tentukan string bagian integer & fraction.
  let integerStr;
  let fractionStr;

  if (decimalScale !== undefined && decimalScale !== null) {
    const rounded = roundHalfUp(absValue, decimalScale);
    [integerStr, fractionStr = ""] = rounded.split(".");
  } else {
    // Pertahankan desimal apa adanya, hindari notasi ilmiah.
    const plain = absValue.toLocaleString("en-US", {
      useGrouping: false,
      maximumFractionDigits: 20,
    });
    [integerStr, fractionStr = ""] = plain.split(".");
  }

  // Sisip group separator tiap 3 digit pada bagian integer.
  if (groupSeparator) {
    integerStr = integerStr.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  }

  const sign = isNegative ? "-" : "";
  const decimalPart = fractionStr ? `${decimalSeparator}${fractionStr}` : "";

  return `${prefix}${sign}${integerStr}${decimalPart}${suffix}`;
}

/**
 * Menormalkan tanda minus pada string input: minus hanya valid satu kali dan
 * di posisi paling depan. Mengetik `-` di mana pun (mis. `12-3`, `5-`) tetap
 * berarti nilai negatif dengan minus dipindah ke depan.
 * @param {string} str string ter-sanitasi (digit + separator + minus)
 * @param {boolean} [allowNegative] bila false, semua minus dibuang; default `true`
 * @returns {string}
 */
export function normalizeSign(str, allowNegative = true) {
  if (typeof str !== "string" || str === "") {
    return str ?? "";
  }
  const negative = allowNegative && str.includes("-");
  const stripped = str.replaceAll("-", "");
  return negative ? `-${stripped}` : stripped;
}

/**
 * Memformat string mentah yang sedang diketik secara realtime:
 * menyisipkan group separator pada bagian integer TANPA membulatkan desimal.
 *
 * Berbeda dari formatNumber, fungsi ini bekerja pada string (bukan number)
 * sehingga input sementara seperti `1.`, `1.50`, `-` tetap dipertahankan apa
 * adanya — pembulatan decimalScale ditunda hingga onBlur.
 * @param {string} raw string angka mentah (decimalSeparator sudah berupa `.`)
 * @param {object} [options]
 * @param {string} [options.groupSeparator] pemisah ribuan; default `,`
 * @param {string} [options.decimalSeparator] pemisah desimal; default `.`
 * @param {string} [options.prefix] teks di depan angka; default `""`
 * @param {string} [options.suffix] teks di belakang angka; default `""`
 * @returns {string}
 */
export function formatTyping(raw, options = {}) {
  const {
    groupSeparator = ",",
    decimalSeparator = ".",
    prefix = "",
    suffix = "",
  } = options;

  if (raw === "" || raw === null || raw === undefined) {
    return "";
  }

  const str = String(raw);
  const isNegative = str.startsWith("-");
  const unsigned = isNegative ? str.slice(1) : str;

  // Pisah bagian integer & fraction berdasarkan titik pertama; pertahankan
  // titik trailing dan nol trailing apa adanya.
  const dotIndex = unsigned.indexOf(".");
  let integerDigits = dotIndex === -1 ? unsigned : unsigned.slice(0, dotIndex);
  const hasDot = dotIndex !== -1;
  const fractionDigits = hasDot ? unsigned.slice(dotIndex + 1) : "";

  // Buang leading zero berlebih: "007" -> "7", "00" -> "0", "0" -> "0".
  // Zero tunggal dipertahankan agar "0." / "0.5" tetap valid saat mengetik.
  if (integerDigits.length > 1) {
    integerDigits = integerDigits.replace(/^0+/, "");
    if (integerDigits === "") integerDigits = "0";
  }

  // Sisip group separator pada bagian integer (digit saja).
  if (groupSeparator) {
    integerDigits = integerDigits.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      groupSeparator,
    );
  }

  const sign = isNegative ? "-" : "";
  const decimalPart = hasDot ? `${decimalSeparator}${fractionDigits}` : "";

  return `${prefix}${sign}${integerDigits}${decimalPart}${suffix}`;
}

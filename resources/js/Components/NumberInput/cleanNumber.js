/**
 * Escape karakter spesial regex agar separator arbitrer aman dipakai di pattern.
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Membersihkan string display menjadi string angka mentah yang siap di-parseFloat.
 *
 * Membuang prefix, suffix, dan seluruh group separator, lalu menormalkan
 * decimalSeparator menjadi `.`. Tanda minus dipertahankan.
 * @param {string} str
 * @param {object} [options]
 * @param {string} [options.groupSeparator]
 * @param {string} [options.decimalSeparator]
 * @param {string} [options.prefix]
 * @param {string} [options.suffix]
 * @returns {string} string angka mentah ("" jika tak ada digit)
 */
export function cleanNumber(str, options = {}) {
  const {
    groupSeparator = ",",
    decimalSeparator = ".",
    prefix = "",
    suffix = "",
  } = options;

  if (str === null || str === undefined) {
    return "";
  }

  let value = String(str).trim();

  // Buang prefix & suffix lebih dulu agar tidak mengganggu parsing separator.
  if (prefix && value.startsWith(prefix)) {
    value = value.slice(prefix.length);
  }
  if (suffix && value.endsWith(suffix)) {
    value = value.slice(0, value.length - suffix.length);
  }

  // Deteksi negatif sebelum strip karakter non-digit.
  const isNegative = /-/.test(value);

  // Buang group separator.
  if (groupSeparator) {
    value = value.replace(new RegExp(escapeRegExp(groupSeparator), "g"), "");
  }

  // Normalisasi decimal separator menjadi titik.
  if (decimalSeparator && decimalSeparator !== ".") {
    value = value.replace(new RegExp(escapeRegExp(decimalSeparator), "g"), ".");
  }

  // Sisakan hanya digit dan titik desimal (pertama).
  const parts = value.replace(/[^\d.]/g, "").split(".");
  const integer = parts.shift() ?? "";
  const fraction = parts.join("");

  if (integer === "" && fraction === "") {
    return "";
  }

  const cleaned = fraction !== "" ? `${integer}.${fraction}` : integer;

  return isNegative ? `-${cleaned}` : cleaned;
}

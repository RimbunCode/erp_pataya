/**
 * Perhitungan indikator seimbang Journal Voucher dalam minor unit mata uang dasar (Requirement 12.1). Aturannya sama
 * dengan `JournalDraftValidator` di server: tiap nilai dibulatkan HALF_UP ke minor unit, lalu Σdebit dan Σkredit
 * dibandingkan sebagai bilangan bulat, sehingga tidak bergantung pada galat floating point.
 */

/**
 * Bilangan bulat minor unit dari sebuah nominal (HALF_UP). Notasi eksponen string ("1.005e2") dipakai agar 1.005
 * pada 2 desimal menjadi 101, bukan 100 akibat 1.005 * 100 = 100.49999999999999.
 * @param {number|string|null|undefined} value
 * @param {number} minorUnit
 * @returns {number}
 */
export function toMinor(value, minorUnit = 2) {
  if (value === null || value === undefined || value === "") return 0;
  const text = String(value);
  const number = Number(text);
  if (!Number.isFinite(number)) return 0;
  if (/e/i.test(text)) return Math.round(number * 10 ** minorUnit);

  const shifted = Number(`${text}e${minorUnit}`);
  return Number.isFinite(shifted) ? Math.round(shifted) : 0;
}

/**
 * Baris dianggap terisi bila punya akun atau salah satu sisi bernilai (baris kosong di ujung tabel diabaikan).
 * @param {object} row
 * @returns {boolean}
 */
const isFilled = (row) =>
  Boolean(row?.account?.id) ||
  Number(row?.debit ?? 0) !== 0 ||
  Number(row?.credit ?? 0) !== 0;

/**
 * @typedef {object} BalanceSummary
 * @property {number} debitMinor
 * @property {number} creditMinor
 * @property {number} differenceMinor debit dikurangi kredit
 * @property {number} lineCount jumlah baris terisi
 * @property {"too_few"|"unbalanced"|"balanced"} state
 */

/**
 * @param {object[]} items baris voucher (`account`, `debit`, `credit`)
 * @param {number} minorUnit jumlah desimal mata uang dasar
 * @returns {BalanceSummary}
 */
export function summarizeBalance(items, minorUnit = 2) {
  const rows = (items ?? []).filter(isFilled);
  const debitMinor = rows.reduce(
    (sum, row) => sum + toMinor(row.debit, minorUnit),
    0,
  );
  const creditMinor = rows.reduce(
    (sum, row) => sum + toMinor(row.credit, minorUnit),
    0,
  );
  const differenceMinor = debitMinor - creditMinor;

  let state = "unbalanced";
  if (rows.length < 2) {
    state = "too_few";
  } else if (differenceMinor === 0 && debitMinor > 0) {
    state = "balanced";
  }

  return {
    debitMinor,
    creditMinor,
    differenceMinor,
    lineCount: rows.length,
    state,
  };
}

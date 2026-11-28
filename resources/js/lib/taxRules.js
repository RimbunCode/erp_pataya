/**
 * Aturan pajak berversi untuk form invoice (Finance Fase 3, Bagian B, Requirement 12.8). Faktor DPP, tarif, dan
 * perilaku pajak SELALU berasal dari versi aturan yang dikirim server (`taxRuleVersions`), bukan konstanta di klien:
 * perubahan regulasi cukup versi aturan baru. Angka yang disimpan dokumen dihitung `TaxEngine` di server; fungsi di
 * sini hanya untuk pratinjau sebelum simpan dan keputusan menampilkan kolom DPP.
 */

export const EMPTY_TAX_RULE_VERSIONS = Object.freeze([]);

function pad(value) {
  return String(value).padStart(2, "0");
}

/**
 * Hari (Y-m-d) dari tanggal dokumen TANPA konversi zona waktu: string dari server diambil bagian tanggalnya apa
 * adanya (tanggal bisnis yang sama dengan yang dipakai server memilih versi aturan); objek Date dibaca dengan
 * komponen lokal; kosong/tidak valid = hari ini (lokal).
 * @param {string|Date|null|undefined} date
 * @returns {string}
 */
export function toDay(date) {
  if (typeof date === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(date.trim());
    if (match) return match[1];
  }

  const parsed =
    date instanceof Date ? date : date ? new Date(date) : new Date();
  const valid = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return `${valid.getFullYear()}-${pad(valid.getMonth() + 1)}-${pad(valid.getDate())}`;
}

/**
 * Versi aturan untuk sebuah pajak: versi yang tersimpan pada baris (`versionId`, dokumen yang sudah disimpan) bila
 * cocok dengan pajaknya; selain itu versi `active` yang berlaku pada tanggal dokumen (sama dengan resolver server).
 * @param {Array<object>} versions `taxRuleVersions` dari server
 * @param {string|null|undefined} taxId id pajak baris
 * @param {string|Date|null|undefined} date tanggal dokumen
 * @param {string|null} [versionId] versi tersimpan pada baris
 * @returns {{versionId: string, rate: number, numerator: number, denominator: number, dppFactor: number, additive: boolean, showsDpp: boolean}|null}
 */
export function resolveTaxRule(versions, taxId, date, versionId = null) {
  if (!taxId) return null;
  const list = Array.isArray(versions) ? versions : EMPTY_TAX_RULE_VERSIONS;

  let version = versionId
    ? list.find((v) => v.id === versionId && v.tax_id === taxId)
    : undefined;

  if (!version) {
    const day = toDay(date);
    version = list
      .filter(
        (v) =>
          v.tax_id === taxId &&
          v.status === "active" &&
          v.effective_from <= day &&
          (!v.effective_to || v.effective_to >= day),
      )
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  }

  if (!version) return null;

  const numerator = Number(version.dpp_numerator) || 1;
  const denominator = Number(version.dpp_denominator) || 1;

  return {
    versionId: version.id,
    rate: Number(version.rate),
    numerator,
    denominator,
    dppFactor: numerator / denominator,
    additive: version.behavior !== "withholding",
    // DPP hanya ditampilkan bila faktor versi selain 1/1 (Requirement 12.8).
    showsDpp: numerator !== denominator,
  };
}

/**
 * Pajak baris dalam bentuk daftar (pajak majemuk per item, spek finance-multi-tax-per-item): `taxes` bila terisi;
 * selain itu bentuk satu pajak lama (`tax`, atau hanya `tax_id`). Urutan = urutan pilihan (Pajak Utama pertama).
 * @param {object|null|undefined} row baris item
 * @returns {Array<object>}
 */
export function taxesOfRow(row) {
  if (Array.isArray(row?.taxes) && row.taxes.length > 0) return row.taxes;
  if (row?.tax) return [row.tax];
  if (row?.tax_id) return [{ id: row.tax_id }];

  return [];
}

/**
 * `resolveTaxRule` per pajak baris. Versi tersimpan dibaca dari pivot (`taxes[].pivot.tax_rule_version_id`, dokumen
 * yang sudah disimpan) atau, untuk bentuk satu pajak lama, dari `tax_rule_version_id` baris.
 * @param {object|null|undefined} row baris item
 * @param {Array<object>} versions `taxRuleVersions` dari server
 * @param {string|Date|null|undefined} date tanggal dokumen
 * @returns {Array<{tax: object, taxId: string, rule: ReturnType<typeof resolveTaxRule>}>} `rule` null = tanpa versi berlaku
 */
export function rulesOf(row, versions, date) {
  const hasList = Array.isArray(row?.taxes) && row.taxes.length > 0;

  return taxesOfRow(row).map((tax, index) => ({
    tax,
    taxId: tax?.id,
    rule: resolveTaxRule(
      versions,
      tax?.id,
      date,
      tax?.pivot?.tax_rule_version_id ??
        (!hasList || index === 0 ? row?.tax_rule_version_id : null) ??
        null,
    ),
  }));
}

/**
 * Kolom DPP tampil bila SALAH SATU pajak PENAMBAH baris berfaktor selain 1/1 (Requirement 10.3).
 * @param {ReturnType<typeof rulesOf>} entries
 * @returns {boolean}
 */
export function showsDppOf(entries) {
  return (entries ?? []).some(
    (entry) => entry.rule?.additive && entry.rule?.showsDpp,
  );
}

const PPN_CATEGORIES = ["ppn_standard", "ppn_luxury"];

/**
 * Pajak yang DPP-nya menjadi `dpp_amount` item (sama dengan InvoiceItemTaxCalculator::aggregateDpp): pajak berkategori
 * PPN pertama; bila tak ada, pajak penambah pertama; bila tak ada, pajak pertama. Pajak tanpa versi aturan dilewati.
 * @param {ReturnType<typeof rulesOf>} entries
 * @returns {ReturnType<typeof rulesOf>[number]|null}
 */
export function dppSourceOf(entries) {
  const resolved = (entries ?? []).filter((entry) => entry.rule);

  return (
    resolved.find((entry) => PPN_CATEGORIES.includes(entry.tax?.category)) ??
    resolved.find((entry) => entry.rule.additive) ??
    resolved[0] ??
    null
  );
}

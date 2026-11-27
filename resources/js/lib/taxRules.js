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
 *
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

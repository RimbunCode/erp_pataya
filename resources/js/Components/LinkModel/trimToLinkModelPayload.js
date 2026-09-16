// Kolom struktural yang SELALU aman (sinkron dgn ModelController::ALWAYS_ALLOWED_ATTRIBUTES
// + id) -- lihat app/Http/Controllers/ModelController.php.
const ALWAYS_ALLOWED_ATTRIBUTES = [
  "id",
  "route",
  "canDelete",
  "canUpdate",
  "keyModel",
  "appendStatus",
  "thisModel",
  "templateLink",
  "disabledOn",
];

/**
 * Pangkas row hasil browse Advance Search Dialog (yang berisi SEMUA kolom
 * linkable, lihat buildAdvanceSearchColumnMap) ke bentuk payload yang SAMA
 * seperti hasil pemilihan dari dropdown LinkModel biasa -- kolom struktural +
 * kolom sumber templateLink + (fields ∩ linkable, direpresentasikan sbg
 * `fields` di sini krn row yg diterima sudah lolos gate linkable server).
 * Requirement 7.
 * @param {object} row row lengkap dari Advance Search Dialog
 * @param {object} opts
 * @param {string[]} [opts.fields] prop `fields` LinkModel
 * @param {string[]} [opts.templateLinkColumnNames] nama kolom sumber
 *   templateLink (dari response `selectData` field `templateLinkColumns`)
 * @returns {object}
 */
export function trimToLinkModelPayload(
  row,
  { fields, templateLinkColumnNames } = {},
) {
  if (!row) return row;
  const allowed = new Set([
    ...ALWAYS_ALLOWED_ATTRIBUTES,
    ...(templateLinkColumnNames ?? []),
    ...(fields ?? []),
  ]);
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => allowed.has(key)),
  );
}

export default trimToLinkModelPayload;

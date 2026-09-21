// resolveSearchColumns — tentukan kolom yang dicari oleh Chip Cari (teks
// bebas). Fungsi murni, dipanggil host SAAT Enter ditekan (bukan disimpan
// sebagai state), lihat design.md §6.2 & Requirement 5.4-5.6.

/**
 * `searchScope` (prop Inertia yang sudah disanitasi backend) menang bila
 * tidak kosong. Bila kosong, fallback ke Kolom tampil ∩ `searchable !==
 * false` ∩ tipe `string` level-atas (tanpa `parentCol`).
 * @param {object} root0
 * @param {string[]} [root0.searchScope] daftar kolom (boleh path relasi
 *   bertitik) hasil `getSearchScope()` model, sudah tersanitasi backend.
 * @param {object} root0.columns peta kolom keyed-by-name (getColumns()).
 * @param {string[]} root0.visibleNames nama kolom yang sedang tampil
 *   (createHeaders() -> cookie visibility).
 * @returns {string[]}
 */
const resolveSearchColumns = ({ searchScope, columns, visibleNames } = {}) => {
  if (Array.isArray(searchScope) && searchScope.length > 0) {
    return searchScope;
  }

  return (visibleNames ?? []).filter((name) => {
    const col = columns?.[name];
    return (
      Boolean(col) &&
      col.searchable !== false &&
      col.type === "string" &&
      !col.parentCol
    );
  });
};

export { resolveSearchColumns };

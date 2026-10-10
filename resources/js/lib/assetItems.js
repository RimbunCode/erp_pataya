/**
 * Spec asset-items-section: form SO, Sales Invoice, dan Delivery Note punya dua
 * FormTable -- `items` (barang biasa) dan `asset_items` (aset tetap) -- yang
 * disimpan ke tabel `*_items` yang sama di backend. Total dokumen dan alokasi
 * diskon harus dihitung dari GABUNGAN keduanya, bukan dari satu tabel saja.
 */

/**
 * Gabungan baris kedua tabel, `items` lebih dulu lalu `asset_items`.
 * @param {{items?: object[]|null, asset_items?: object[]|null}} data
 * @returns {object[]}
 */
export const getAllItems = (data) => [
  ...(data?.items ?? []),
  ...(data?.asset_items ?? []),
];

export const assetIdOfRow = (row) =>
  row?.asset_id ??
  row?.asset?.id ??
  row?.sales_order_item?.asset_id ??
  row?.referenceable?.asset_id;

/** @returns {{items: object[], asset_items: object[]}} */
/**
 * @param {object[]|null|undefined} rows
 * @returns {{items: object[], asset_items: object[]}}
 */
export const partitionRowsByAssetId = (rows) => {
  const items = [];
  const assetItems = [];

  (rows ?? []).forEach((row) => {
    (assetIdOfRow(row) ? assetItems : items).push(row);
  });

  return { items, asset_items: assetItems };
};

/**
 * Konteks alokasi diskon untuk `mapItem` milik salah satu FormTable.
 *
 * `mapItem` FormTable hanya menerima `dataTable` (baris tabelnya sendiri), padahal
 * diskon dokumen dialokasikan pro-rata ke SEMUA baris kedua tabel. Fungsi ini
 * menyusun daftar baris gabungan dengan `dataTable` tabel aktif menggantikan
 * bucket-nya, plus posisi baris yang sedang dipetakan di daftar gabungan itu.
 *
 * Catatan: baris di TABEL LAIN diambil dari `data` saat closure dibuat, jadi
 * angka per-baris di tabel lain baru ter-refresh ketika tabelnya sendiri berubah
 * (header dokumen memakai getAllItems yang selalu reaktif, dan server menghitung
 * ulang alokasi saat menyimpan).
 * @param {object} params
 * @param {"item"|"asset"} params.kind tabel yang sedang dipetakan
 * @param {object[]|null|undefined} params.dataTable baris tabel aktif (dari mapItem)
 * @param {number} params.index posisi baris di `dataTable`
 * @param {{items?: object[]|null, asset_items?: object[]|null}} params.data state form
 * @returns {{rows: object[], index: number}}
 */
export const allocationContext = ({ kind, dataTable, index, data }) => {
  const tableRows = dataTable ?? [];
  const itemRows = kind === "asset" ? (data?.items ?? []) : tableRows;
  const assetRows = kind === "asset" ? tableRows : (data?.asset_items ?? []);

  return {
    rows: [...itemRows, ...assetRows],
    index: kind === "asset" ? itemRows.length + index : index,
  };
};

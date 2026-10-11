// groupAutoExpand — keputusan grup mana yang dibuka otomatis (spec
// linkmodel-grouping-search, Requirement 8.10-8.13). Murni: hanya memakai
// `count` deskriptor yang SUDAH ada, jadi tak ada request tambahan hanya untuk
// memutuskan.

export const AUTO_EXPAND_MAX_GROUPS = 3;

/**
 * Pilih deskriptor yang dibuka otomatis: berurutan selama jumlah kumulatif
 * `count` masih muat di `budget`, maksimum `maxGroups`. Deskriptor PERTAMA
 * selalu dibuka walau `count`-nya melebihi anggaran (user melihat baris
 * pertama tanpa klik; sisanya lewat scroll/pager node itu).
 * @param {Array<{count?: number}>} items deskriptor grup sebuah level
 * @param {object} options
 * @param {number} options.budget anggaran baris (umumnya ukuran halaman)
 * @param {number} [options.maxGroups] maks deskriptor dibuka
 * @returns {Array<object>} subset `items` yang dibuka (urutan asli)
 */
export const computeAutoExpand = (
  items,
  { budget, maxGroups = AUTO_EXPAND_MAX_GROUPS },
) => {
  const picked = [];
  let used = 0;
  for (const item of items ?? []) {
    if (picked.length >= maxGroups) break;
    const count = Number(item?.count) || 0;
    if (picked.length > 0 && used + count > budget) break;
    picked.push(item);
    used += count;
  }

  return picked;
};

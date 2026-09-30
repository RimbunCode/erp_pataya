// isFilterTreeDirty — dipindah apa adanya dari `FilterTable2.jsx` (useMemo
// `isDirty`, :217-240) agar bisa dipakai bersama oleh FilterTable2 dan
// SearchBar (Requirement 10.5). Perilaku TIDAK berubah: bandingkan SELURUH
// item (termasuk yang belum lengkap) secara urutan-independen -- agar
// perubahan sekecil apa pun (mis. ganti operator, tambah item kosong)
// langsung terdeteksi.

/**
 * Kumpulkan seluruh leaf item `[k, o, v]` secara rekursif dari peta node
 * (`{ [id]: node }`). Mendukung bentuk `c` (tree state internal) maupun
 * `children` (bentuk lain yang dipakai beberapa konsumen).
 * @param {object} nodes
 * @param {Array<[string, string, *]>} acc
 * @returns {Array<[string, string, *]>}
 */
const collectItems = (nodes, acc = []) => {
  for (const node of Object.values(nodes ?? {})) {
    if (!node || typeof node !== "object") continue;
    const children = node.c ?? node.children;
    if (children && typeof children === "object") {
      collectItems(children, acc);
    } else {
      acc.push([node.k ?? "", node.o ?? "", node.v ?? ""]);
    }
  }
  return acc;
};

/**
 * Normalisasi tree jadi string yang urutan-independen -- dua tree dengan
 * item sama tapi urutan anak berbeda menghasilkan string yang sama.
 * @param {object} tree
 * @returns {string}
 */
const norm = (tree) => {
  const root = tree?.root ?? tree;
  return JSON.stringify(
    collectItems(root?.c ?? root?.children ?? {})
      .map((x) => JSON.stringify(x))
      .sort(),
  );
};

/**
 * Apakah `currentTree` berbeda dari `savedTree` -- dibandingkan sebagai
 * kumpulan leaf item (urutan-independen). Caller (mis. `FilterTable2`)
 * bertanggung jawab atas guard "kapan perbandingan ini relevan" (mis. hanya
 * saat named filter yang dimuat, `is_saved=true`).
 * @param {object} savedTree
 * @param {object} currentTree
 * @returns {boolean}
 */
const isFilterTreeDirty = (savedTree, currentTree) =>
  norm(savedTree) !== norm(currentTree);

export { isFilterTreeDirty };

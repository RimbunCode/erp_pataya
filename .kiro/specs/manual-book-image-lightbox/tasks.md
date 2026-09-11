# Tasks — Manual Book Image Lightbox

Acuan: `requirements.md` (Req 1–6), `design.md` (§1–§10).

Status: `[ ]` todo · `[~]` queued · `[-]` in progress · `[x]` done
Task opsional ditandai `- [ ]* <id>`.

Aturan proyek: satu task sekaligus, tandai `[-]` saat mulai, `[x]` hanya jika
implementasi + test/build pass. Lint/Pint hanya setelah SEMUA task selesai.
Checkpoint = STOP: jalankan full test suite + konfirmasi user.

---

## T01 — Tambah dependency `react-zoom-pan-pinch`

- [x] T01
- **Ref:** design §6, Req 2
- Jalankan `npm install react-zoom-pan-pinch@^3`.
- Pastikan masuk `dependencies` (bukan `devDependencies`) di `package.json`.
- Commit `package.json` + `package-lock.json`.
- **Validasi:** `npm ls react-zoom-pan-pinch` menampilkan versi terpasang;
  `npm run build` sukses tanpa error resolusi modul.
- **File berubah:** `package.json`, `package-lock.json`

---

## T02 — Rename folder gambar `Penjualan/` → `penjualan/` + bereskan berkas liar

- [x] T02
- **Ref:** design §7.1, §7.2, §10 (risiko casing), Req 6.2, 6.5, 6.6
- **Hasil:** folder `Penjualan/` → `penjualan/` (via nama antara; berkas belum
  di-track git jadi `mv` biasa, bukan `git mv`). Pemetaan 8 berkas liar (semua
  ketemu slot, 0 dihapus):
  - `Langkah1.png` → `form-sales-order.png` (timpa placeholder)
  - `Sales Order Baru.png` → `list-sales-orders.png` (timpa)
  - `Langkah2.png` → `menu-aksi-so.png` (timpa)
  - `Langkah2 - 1.png` → `form-delivery-note.png` (timpa)
  - `Langkah3 - 1.png` → `form-sales-invoice.png` (timpa)
  - `Langkah1 submit.png` → `detail-sales-order-draft.png` (BARU, dipakai T07)
  - `Langkah2 - 2.png` → `detail-delivery-note-draft.png` (BARU, dipakai T07)
  - `Langkah3 -2.png` → `detail-sales-invoice-draft.png` (BARU, dipakai T07)
  - Masih 1×1 (belum ada SS asli, sengaja): `detail-sales-order`, `form-customer`,
    `form-payment-entry`, `list-customers`, `list-delivery-notes`,
    `list-internal-orders`.
  - `retur.md:43` → `form-delivery-note.png` tetap resolve (kini SS asli).
- Rename folder via nama antara supaya efektif di FS case-insensitive:
  1. `git mv "docs/manual-book/images/Penjualan" "docs/manual-book/images/penjualan-tmp"`
  2. `git mv "docs/manual-book/images/penjualan-tmp" "docs/manual-book/images/penjualan"`
  3. `git ls-files docs/manual-book/images/penjualan/ | head` → konfirmasi huruf kecil.
- Untuk tiap berkas liar (`Langkah1.png`, `Langkah1 submit.png`, `Langkah2*.png`,
  `Langkah3*.png`, `Sales Order Baru.png`): buka & lihat isinya, lalu:
  - jika cocok slot placeholder di `penjualan.md` → `git mv` ke nama kebab-case
    yang sesuai (mis. `form-sales-order.png`), menimpa placeholder 1×1 yang ada.
  - jika tidak cocok slot mana pun / bukan screenshot final → `git rm`.
  - **Laporkan keputusan per-berkas** di ringkasan task.
- Placeholder 1×1 yang belum ada pengganti asli → **biarkan** (fitur error-guard
  Req 5.2 perlu diuji terhadapnya).
- Verifikasi `retur.md:43` (`/manual-book-images/penjualan/form-delivery-note.png`)
  masih menunjuk berkas yang ada — tidak perlu edit `retur.md` bila berkas ada.
- **Validasi:** `ls docs/manual-book/images/penjualan/`; tidak ada folder
  `Penjualan/` (kapital) tersisa di `git ls-files`.
- **File berubah:** `docs/manual-book/images/penjualan/*` (rename/hapus)

---

## T03 — Komponen `ManualBookImageLightbox.jsx`

- [x] T03
- **Ref:** design §3.4, §3.5; Req 1.2–1.4, Req 2, Req 3, Req 5
- **Hasil:** `ManualBookImageLightbox.jsx` dibuat. `Dialog` + `TransformWrapper`
  render-prop (toolbar zoom di dalam wrapper — `useControls` butuh context).
  T03a (deteksi 1×1 via `onLoad naturalWidth/Height <= 1` → overlay teks +
  sembunyikan img) langsung diimplementasi, bukan opsional. Key i18n pakai
  fallback string (pola `Show.jsx`, `core.manualBook.*` belum ada di lang).
  ESLint bersih, `npm run build` sukses.
- Buat `resources/js/Components/ManualBook/ManualBookImageLightbox.jsx`:
  - Props: `{ open, src, alt, onOpenChange }`.
  - `<Dialog>` + `<DialogContent hideX align="center" className="max-w-[95vw] h-[92vh] p-0 bg-black/95 border-0 overflow-hidden">`.
  - `<DialogTitle className="sr-only">` = `alt || "Gambar Manual Book"` (Req 5.3).
  - `TransformWrapper` (`initialScale={1}`, `minScale={1}`, `maxScale={8}`,
    `centerOnInit`, `wheel={{ step: 0.15 }}`, `doubleClick={{ mode: "toggle", step: 2 }}`).
  - `TransformComponent` isi `<img src={src} alt={alt}
    className="max-w-full max-h-full object-contain select-none" draggable={false}
    onError={...} onLoad={...}>`.
  - Toolbar pojok atas (absolute, z tinggi): tombol ZoomIn / ZoomOut /
    reset (`resetTransform`) / X (`onOpenChange(false)`) — ikon `lucide-react`.
  - Strip caption bawah = `alt` bila ada (Req 5.3: skip bila kosong).
  - State `errored`: `onError` → tampilkan panel "Gambar belum tersedia" +
    tombol Tutup, sembunyikan `TransformWrapper` (Req 5.1).
  - `- [ ]* T03a` (opsional): `onLoad` cek `naturalWidth <= 1 && naturalHeight <= 1`
    → overlay teks "Screenshot untuk bagian ini belum ditambahkan."
- **Validasi:** `npm run build` sukses; komponen ter-import tanpa error.
  Verifikasi visual penuh di T10 (checklist manual).
- **File berubah:** `resources/js/Components/ManualBook/ManualBookImageLightbox.jsx` (baru)

---

## T04 — `decorateImages` + delegation di `MarkdownMermaidRenderer.jsx`

- [x] T04
- **Ref:** design §3.1, §3.2, §3.5; Req 1.1, 1.5, 1.6, 1.7, 4.2, 4.3
- **Hasil:** prop `onImageActivate` + 2 useEffect terpisah di
  `MarkdownMermaidRenderer.jsx`: `decorateImages` (`[html]`, idempoten,
  guard `.manual-book-mermaid`) & delegation listener (`[onImageActivate]`,
  click + keydown Enter/Space). ESLint/prettier bersih. Build diverifikasi di T05.
- Tambah prop `onImageActivate` ke `MarkdownMermaidRenderer`.
- `useEffect` baru `decorateImages`, dependency `[html]`:
  - `container.querySelectorAll("img")`, untuk tiap `img`:
    - skip bila `img.closest(".manual-book-mermaid")` (Req 1.7).
    - skip bila `img.dataset.lightbox === "true"` (idempoten).
    - set `dataset.lightbox="true"`, `role="button"`, `tabindex="0"`,
      `classList.add("cursor-zoom-in")`, `aria-label`.
  - **Tidak** mengubah struktur DOM / tidak `setState` yang mengubah `html`.
- `useEffect` terpisah untuk listener delegation, dependency `[onImageActivate]`:
  - `container.addEventListener("click", handleActivate)` +
    `"keydown"` (Enter / Space).
  - `handleActivate`: `e.target.closest("img[data-lightbox='true']")` → bila ada,
    `e.preventDefault()`, `onImageActivate({ src: img.currentSrc || img.src, alt: img.alt || "" })`.
  - cleanup `removeEventListener`.
- Pastikan effect delegation **terpisah** dari effect `renderDiagrams` (jangan
  gabung) supaya tidak memicu ulang render Mermaid (design §3.5, Req 4.2).
- **Validasi:** `npm run build` sukses. Test render Mermaid tetap jalan
  diverifikasi di T10.
- **File berubah:** `resources/js/Components/ManualBook/MarkdownMermaidRenderer.jsx`

---

## T05 — Wire state lightbox di `Show.jsx`

- [x] T05
- **Ref:** design §3.3, §5; Req 1.1, 3.4, 4.1, 4.4
- **Hasil:** `Show.jsx` — `lazy()` import lightbox, state `{open,src,alt}`,
  `openLightbox`/`handleLightboxOpenChange` (useCallback), prop `onImageActivate`
  ke renderer, div `.manual-book-content` sebagai anchor CSS T06. Modal di-mount
  kondisional (`{lightbox.open && <Suspense>}`) → chunk JS baru dimuat saat klik
  pertama. Build: chunk `ManualBookImageLightbox` 31.88 kB gzip 10.39 kB
  terpisah dari bundle halaman.
- Di `resources/js/Pages/Core/ManualBook/Show.jsx`:
  - `const ManualBookImageLightbox = lazy(() => import(".../ManualBookImageLightbox"))`.
  - `const [lightbox, setLightbox] = useState({ open: false, src: "", alt: "" })`.
  - `openLightbox` / `closeLightbox` via `useCallback`.
  - Kirim `onImageActivate={openLightbox}` ke `<MarkdownMermaidRenderer>`.
  - Render `<Suspense fallback={null}><ManualBookImageLightbox {...lightbox}
    onOpenChange={(o) => !o && closeLightbox()} /></Suspense>` (hanya saat
    `lightbox.open` untuk hindari load library sebelum perlu — atau selalu
    render tapi biarkan `React.lazy` + `open` gate; pilih yang lebih bersih).
  - Bungkus area konten dengan `<div className="manual-book-content">` (penanda
    untuk CSS T06) — pastikan tidak merusak grid layout yang ada.
- **Validasi:** `npm run build` sukses; halaman `/manual-book/sales` load tanpa
  error konsol.
- **File berubah:** `resources/js/Pages/Core/ManualBook/Show.jsx`

---

## T06 — CSS afordansi hover + print guard (`app.css`)

- [x] T06
- **Ref:** design §4, §5; Req 1.5, 4.1
- **Hasil:** `app.css` — 2 aturan afordansi (`cursor: zoom-in` + hover
  brightness/ring) di-scope `.manual-book-content .prose img[data-lightbox]`;
  di `@media print` reset afordansi + `display:none` untuk
  `[role="dialog"][data-state="open"]` & popper wrapper. Fallback ring pakai
  `oklch(0.7 0.15 250)` kalau `--color-ring` tak ada. Build sukses.
- Di `resources/css/app.css`:
  - `.manual-book-content .prose img[data-lightbox="true"]` → `cursor: zoom-in`,
    transisi halus.
  - `:hover` → `filter: brightness(0.97)` + `box-shadow` ring tipis.
  - Di `@media print` (blok yang sudah ada, sekitar baris 776–821):
    - reset `cursor`/`filter`/`box-shadow` untuk `img[data-lightbox]`.
    - `[data-radix-popper-content-wrapper], [role="dialog"][data-state="open"]
      { display: none !important; }`.
- **Validasi:** `npm run build` sukses. Print preview diverifikasi di T10.
- **File berubah:** `resources/css/app.css`

---

## T07 — Penyeragaman placeholder `penjualan.md`

- [x] T07
- **Ref:** design §7.3; Req 6.1, 6.2, 6.4
- **Hasil:** 13 rujukan `![...]` di `penjualan.md` diseragamkan — semua deskripsi
  kini menjelaskan isi layar. 3 SS draft baru disisipkan (detail SO/DN/SI Draf +
  tombol Ajukan, cocok dengan teks "klik Ajukan dari halaman detail"). Rujukan
  `detail-sales-order.png` → `detail-sales-order-draft.png`; berkas 1×1
  `detail-sales-order.png` yang tak lagi dirujuk dihapus. 13 path = 13 berkas
  (7 SS asli, 6 masih 1×1: form-customer, form-payment-entry, list-customers,
  list-delivery-notes, list-internal-orders, list-sales-orders... — koreksi:
  list-sales-orders sudah SS asli, jadi 5 yang 1×1). Tidak ada heading/section
  baru; alur teks Langkah 1–5 tak diubah.
- Untuk tiap `![...]` di `docs/manual-book/penjualan.md`:
  - deskripsi menjelaskan ISI layar (bukan "gambar"/"langkah N").
  - path `/manual-book-images/penjualan/<kebab-case>.png`.
  - selaraskan nama berkas dengan hasil T02 (berkas asli yang sudah di-rename).
- Tambah placeholder di langkah kunci yang jelas butuh screenshot tapi belum
  punya — secukupnya, jangan berlebihan.
- **Tidak** menambah section/heading baru, tidak mengubah urutan, tidak
  menyentuh isi panduan Langkah 1–5 / contoh / FAQ.
- Buat berkas placeholder 1×1 untuk path baru yang belum ada berkasnya
  (copy dari placeholder existing: `cp <ada>.png <baru>.png`).
- **Validasi:** semua path di `penjualan.md` punya berkas nyata di
  `docs/manual-book/images/penjualan/` (dipastikan oleh test T09.3).
- **File berubah:** `docs/manual-book/penjualan.md`,
  `docs/manual-book/images/penjualan/*` (placeholder baru bila perlu)

---

## T08 — Buat `docs/manual-book/README-penulisan.md`

- [x] T08
- **Ref:** design §7.4; Req 6.3 (a–g), 6.4
- **Hasil:** `docs/manual-book/README-penulisan.md` dibuat (6 section: siapkan
  junction, taruh berkas, sintaks + path absolut + alasan catch-all, fitur
  klik-perbesar, ganti placeholder 1×1, checklist commit). Contoh sintaks
  diambil nyata dari `penjualan.md`. Diverifikasi via tinker:
  `renderSection('readme-penulisan')` & `renderSection('README-penulisan')`
  → `NULL`; tidak ada di `config('manual_book.sections')`.
- Buat `docs/manual-book/README-penulisan.md` dengan struktur di design §7.4:
  section 1 (siapkan folder/junction), 2 (taruh berkas), 3 (sintaks + path
  absolut + alasan catch-all), 4 (fitur klik-perbesar dari sisi pembaca),
  5 (ganti placeholder 1×1), 6 (checklist commit).
- Contoh sintaks diambil nyata dari `penjualan.md` hasil T07.
- **JANGAN** menambah entri ke `config/manual_book.php`.
- **Validasi:** test T09.2 (`renderSection` untuk slug ini → `null`).
- **File berubah:** `docs/manual-book/README-penulisan.md` (baru)

---

## T09 — Test PHPUnit

- [x] T09
- **Ref:** design §8.1; Req 1.6, 6.2, 6.3, 6.5, 6.6
- **Hasil:** `tests/Feature/Core/ManualBookImageTest.php` (baru, 4 test):
  `test_penjualan_section_renders_img_with_absolute_manual_book_path`,
  `test_readme_penulisan_is_not_registered_as_section`,
  `test_all_referenced_images_exist_on_disk` (parse semua `docs/manual-book/*.md`),
  `test_image_section_folders_are_lowercase`. Semua hijau (7 assertions).
  Regresi `ManualBookControllerTest` 4/4 hijau — rename folder tak merusak.
- `php artisan make:test --phpunit Core/ManualBookImageTest` (atau tambahkan ke
  test Manual Book yang sudah ada bila ada — cek `tests/Feature/Core/` dulu).
- T09.1 `test_penjualan_section_renders_img_with_absolute_manual_book_path`
- T09.2 `test_readme_penulisan_is_not_registered_as_section`
- T09.3 `test_all_referenced_images_exist_on_disk` (parse semua `.md`)
- T09.4 `test_no_broken_folder_casing`
- **Validasi:** `php artisan test --compact --filter=ManualBookImage` hijau.
- **File berubah:** `tests/Feature/Core/ManualBookImageTest.php` (baru)

---

## T10 — CHECKPOINT: full test suite + verifikasi manual FE

- [-] T10
- **Ref:** design §8.2; semua Req
- **Catatan lingkungan:** `php artisan test` (wrapper) & `php -d memory_limit`
  pada wrapper tetap OOM di 128 MB pada suite penuh (`MakesHttpRequests.php:565`
  spawn worker pakai php.ini sendiri). Isu pre-existing, tak terkait perubahan
  ini. Workaround: `php -d memory_limit=-1 vendor/bin/phpunit` langsung.
  Subset relevan (`ManualBookImageTest` + `ManualBookControllerTest`) → 8/8
  hijau, 82 assertions, 64 MB.
- **STOP — jalankan & laporkan:**
  1. `php -d memory_limit=-1 vendor/bin/phpunit --no-coverage` (full suite) — hijau.
  2. `npm run build` — sukses.
  3. Checklist manual FE (design §8.2), jalankan di browser:
     - klik screenshot asli → modal, gambar tajam resolusi penuh (Req 1.2).
     - gambar besar → fit awal; gambar kecil → tidak di-upscale (Req 1.3/1.4).
     - zoom in sampai teks kecil terbaca; pan drag; reset (Req 2).
     - `Esc` / klik backdrop / tombol X → menutup; fokus balik ke gambar (Req 3).
     - body di belakang overlay tidak scroll (Req 3.5).
     - pindah ke section Pembelian → klik gambar section itu jalan (Req 4.3).
     - diagram Mermaid tetap render; tombol Cetak jadi aktif (Req 4.2).
     - `window.print()` / preview cetak → tidak ada overlay; gambar inline utuh
       (Req 4.1).
     - klik placeholder 1×1 → tidak error JS; modal bisa ditutup (Req 5.1/5.2).
     - viewport ≤768px → gambar fit, tombol X terjangkau (Req 4.6).
  4. Konfirmasi ke user sebelum lanjut ke T11.
- **Hasil otomatis:**
  - Full suite: `php -d memory_limit=-1 vendor/bin/phpunit --no-coverage` →
    **OK, 1370 tests, 3681 assertions, 0 fail / 0 error** (42 deprecation +
    2 skipped, pre-existing). 208 MB, 13m52s.
  - `npm run build` sukses (chunk `ManualBookImageLightbox` code-split).
  - ESLint bersih untuk 3 file JS.
- **Sisa (butuh user — in-app browser tak punya sesi login):** checklist manual
  FE di `https://erp.test/manual-book/sales`.

---

## T11 — Lint / Pint (SETELAH semua task di atas [x])

- [ ] T11
- **Ref:** design §8.3, aturan proyek
- `vendor/bin/pint --dirty --format agent` (file PHP baru: test).
- ESLint/Prettier untuk file JS lewat pipeline proyek yang ada
  (cek `package.json` scripts — mis. `npm run lint`).
- **Validasi:** Pint melaporkan tidak ada isu; lint JS bersih.
- **File berubah:** kemungkinan format-only pada file yang sudah dibuat/diedit.

---

## Catatan Ketergantungan Antar Task

- T01 harus sebelum T03 (library dipakai di komponen).
- T02 harus sebelum T07 (nama berkas final menentukan path di markdown).
- T03 + T04 harus sebelum T05 (Show.jsx merangkai keduanya).
- T05 sebelum T06 (div `manual-book-content` jadi anchor CSS).
- T07 sebelum T08 (contoh di README diambil dari penjualan.md final).
- T02 + T07 + T08 sebelum T09 (test memeriksa berkas & path nyata).
- Semua sebelum T10; T10 pass + konfirmasi user sebelum T11.

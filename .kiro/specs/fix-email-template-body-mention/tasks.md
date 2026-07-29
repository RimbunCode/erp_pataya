# Implementation Plan: fix-email-template-body-mention

## Overview

Dua bug independen di editor body Email Template. Bug #1 (body hilang) butuh investigasi manual dulu untuk konfirmasi kandidat root cause (A: race `useDraftForm` reset vs B: `isUpdatingRef` macet di `TiptapEditor`) sebelum fix ditulis — lihat `design.md` untuk detail kedua kandidat. Bug #2 (scroll/filter/highlight dropdown) sudah jelas fix-nya, tidak butuh investigasi tambahan.

## Tasks

- [x] 1. Investigasi root cause bug #1 (body hilang setelah submit)
  - [x] 1.1 Reproduksi manual di browser (worktree environment: `composer install`, `npm install`, `.env` disalin dari repo utama dengan `APP_URL` port berbeda, `php artisan serve --port=8020` + `npm run dev`, login `admin`/`admin`)
    - Dibuat Email Template baru (model SalesOrder) dengan body berisi 2 tag mention (`{{ $doc->code }}`, `{{ $doc->files }}`) diselingi teks — submit (create) → body TETAP UTUH.
    - Dibuka lagi record yang sama via **hard navigate/reload** (bukan cuma cek state setelah submit) → body TAMPIL KOSONG di editor.
    - Dicek `data-page` attribute Inertia (props asli dari server): `body_html` BENAR dan lengkap, tapi `body_json` mengandung node `{"type":"text","text":null}` di akhir dokumen — node ProseMirror invalid (field `text` wajib string, bukan null).
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Kesimpulan: bukan race `useDraftForm`, bukan murni `isUpdatingRef` macet — root cause adalah `editor.getJSON()` (Tiptap v3.26, `@tiptap/extension-mention`) menghasilkan text node cacat (`text: null`) saat mention node disisipkan di posisi akhir dokumen. Node ini valid untuk diserialize (lolos ke DB), tapi invalid untuk dideserialize — `setContent()`/init `useEditor({content})` gagal parse, hasil akhirnya dokumen kosong tanpa error yang terlihat user.
    - _Requirements: 1.1_

  - [x] 1.3 Kandidat A (`useDraftForm` race) TIDAK terkonfirmasi — response Inertia post-submit maupun fresh page load sama-sama membawa `body_html` benar. Kandidat B (`isUpdatingRef` macet) relevan sebagai EFEK SAMPING (bukan akar), tetap perlu di-fix sebagai defensive guard. Lanjut ke task 2 dengan fix final (sanitasi 2 arah), bukan kandidat A/B terpisah — lihat `design.md` bagian "Rencana fix (final...)".

- [x] 2. Fix bug #1 — sanitasi 2 arah (serialize + deserialize)
  - [x] 2.1 `TiptapEditor.jsx` — tambah util `sanitizeProseMirrorJSON()`
    - Fungsi rekursif: hapus/filter node `{type: "text", text: null|undefined|""}` dari tree JSON ProseMirror
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 `TiptapEditor.jsx` — terapkan sanitasi di `onUpdate` (serialize)
    - Panggil `sanitizeProseMirrorJSON(editor.getJSON())` sebelum `onValueChange(json, html)` — cegah data baru cacat tersimpan ke DB
    - _Requirements: 1.1, 1.2_

  - [x] 2.3 `TiptapEditor.jsx` — terapkan sanitasi + try/catch di init & sync effect (deserialize)
    - `content: value` (init) dan `editor.commands.setContent(value, false)` (sync effect, baris ~478-486): sanitasi `value` sebelum dipakai, bungkus `setContent` dengan `try/catch` (bukan cuma try/finally) + `console.error` saat gagal parse — supaya data lama yang sudah cacat tetap best-effort ter-render, bukan kosong total
    - Pastikan `isUpdatingRef.current = false` tetap jalan di `finally` (fix defensive untuk kandidat B)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.4 Migrasi data lama yang sudah cacat
    - Diverifikasi via browser end-to-end: record uji (`Test Bug Body Mention`, id `01kyprgs3q3fgrt6bcfs1vb30k`) yang sebelumnya cacat (`{"text":null,"type":"text"}`) — dibuka, dirender BENAR (sanitasi deserialize bekerja), diedit ulang (trigger `onUpdate`) & disimpan → `body_json` di DB sekarang BERSIH, node cacat hilang total (sanitasi serialize bekerja)
    - Karena hanya 1 record data uji coba di worktree ini (bukan data produksi), tidak perlu script migrasi massal — cukup dicatat sebagai catatan operasional: **di lingkungan produksi, record lama yang sudah tersimpan dengan `body_json` cacat perlu dibuka ulang di editor dan disimpan sekali (auto-sanitasi saat submit) agar bersih** — TIDAK butuh migration/command permanen karena ini bug yang sudah di-patch di titik masuk (`onUpdate`)
    - _Requirements: 1.2, 1.3_

  - [x] 2.5 Test round-trip body dengan mention tidak hilang
    - **Test: `test_store_accepts_body_json_with_mention_node_at_end` — kirim `body_json` dengan mention node, assert tidak ada exception, data tersimpan**
    - Ditambahkan di `tests/Feature/Core/EmailTemplateCrudTest.php` — 11 passed (22 assertions)
    - Catatan: bug `text:null` sendiri murni di frontend (Tiptap `getJSON()`), sudah diverifikasi manual end-to-end via browser (lihat task 1 & 2.4) — backend tidak perlu tahu/validasi struktur ProseMirror
    - _Requirements: 1.2_
    - _Validates: Requirement 1_

- [ ] 3. Checkpoint - Verifikasi bug #1 selesai
  - `php artisan test --compact --filter=EmailTemplate`
  - Verifikasi manual ulang di browser (WAJIB reload/navigasi baru, bukan cuma cek state setelah submit — bug ini hanya terlihat setelah reload): body dengan mention di posisi akhir tetap tampil utuh setelah submit + reload
  - Konfirmasi ke user sebelum lanjut ke task 4

- [x] 4. Fix bug #2 — Scrollable dropdown
  - [x] 4.1 Update `resources/js/Components/TiptapMentionList.jsx`
    - Root div: `overflow-hidden` diganti `max-h-[300px] overflow-y-auto overflow-x-hidden` (pola sama seperti `CommandList` di `ui/command.jsx:76-82`)
    - _Requirements: 2.1, 2.2_

- [x] 5. Fix bug #2 — Filter berdasarkan label yang ditampilkan
  - [x] 5.1 Update `resources/js/Pages/Core/EmailTemplate/Form.jsx`
    - `mentionSourceForBody` diubah: map dulu ke `{id, label, name}`, baru filter terhadap `label` ATAU `name` (fallback power-user)
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 6. Fix bug #2 — Highlight kata yang cocok
  - [x] 6.1 Update `resources/js/Components/TiptapMentionList.jsx`
    - `query` didestructure dari Tiptap suggestion props
    - Fungsi `highlightMatch(text, query)` ditambahkan — escape regex char, split & wrap match dengan `<mark className="bg-yellow-500">` (React children biasa, bukan `dangerouslySetInnerHTML` — label selalu plain text)
    - Render `item.label` diganti `highlightMatch(item.label, query)`
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Checkpoint - Verifikasi bug #2 selesai
  - Manual browser (screenshot terverifikasi): ketik `@` → dropdown scrollbar terlihat jelas, daftar terbatas tinggi (bukan flat 30+ item). Ketik `@code` → daftar terfilter jadi 2 item yang match, kata "code" ter-highlight kuning di kedua item. Semua 3 requirement (scroll, filter, highlight) bekerja bersamaan.

- [x] 8. Final checkpoint - Lint & full test suite
  - `vendor/bin/pint --dirty --format agent` → pass
  - `npx eslint` pada 3 file JS yang diubah → 0 error, 0 warning
  - `php artisan test --compact --filter=EmailTemplate` → 45 passed (86 assertions), tidak ada regresi
  - `php artisan test --compact` (full suite) → 340 failed, 392 passed. **Bukan regresi dari spec ini** — dikonfirmasi: (1) semua failure berpusat pada error `SQLSTATE[HY000]: cannot start a transaction within a transaction`, sama sekali tidak terkait Email Template; (2) `PurchaseDualFlowTest` (salah satu file gagal di full suite) dijalankan terisolasi sendirian → 23 passed, semua hijau — membuktikan ini masalah test-isolation pre-existing (kemungkinan SQLite in-memory + `RefreshDatabase` bocor state antar test class saat dijalankan berurutan dalam satu proses PHPUnit, dikombinasi PHP 8.4 transaction mode), bukan disebabkan 4 file yang diubah spec ini. Investigasi akar penyebab pastinya dihentikan (proses background di-kill oleh user/sistem) — di luar scope bugfix ini, direkomendasikan jadi spec/investigasi terpisah jika ingin ditindaklanjuti.
  - Dikonfirmasi ke user

## Notes

- Task 1 (investigasi) SELESAI — root cause terkonfirmasi via reproduksi browser nyata (lihat `design.md`): `editor.getJSON()` menghasilkan text node cacat (`text: null`) saat mention di posisi akhir dokumen, valid tersimpan tapi gagal di-render ulang. BUKAN race `useDraftForm` seperti dugaan kandidat A awal.
- Task 2 fix bertingkat: 2.1-2.2 cegah data BARU cacat (serialize), 2.3 selamatkan data LAMA yang sudah cacat tetap best-effort ter-render (deserialize), 2.4 bersihkan data lama yang sudah kepalang tersimpan cacat (termasuk record hasil reproduksi bug ini), 2.5 test regresi.
- Task 4-6 (bug #2) independen dari task 1-3 (bug #1) — bisa dikerjakan duluan jika investigasi bug #1 butuh waktu lebih lama, tapi checkpoint konfirmasi tetap terpisah per bug.
- Lint/Pint hanya dijalankan di akhir (task 8), sesuai aturan project.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["4.1", "5.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "6.1"] },
    { "id": 3, "tasks": ["2.4"] },
    { "id": 4, "tasks": ["2.5"] },
    { "id": 5, "tasks": ["3"] },
    { "id": 6, "tasks": ["7"] },
    { "id": 7, "tasks": ["8"] }
  ]
}
```

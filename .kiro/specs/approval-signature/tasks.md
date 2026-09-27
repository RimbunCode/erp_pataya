# Tasks: Approval Signature

> Status: `[ ]` todo · `[~]` queued · `[-]` in progress · `[x]` done
> Optional task ditandai `- [ ]* <id>`. **Pint/ESLint hanya dijalankan setelah SEMUA task selesai.**

## T01: Migration & Model — Kolom TTD

- [x] 1. Migration `add_signature_to_users_table`: `foreignUlid('signature_file_id')` nullable, `after('image')`, `constrained('files')`, `nullOnDelete()`
- [x] 2. `app/Models/User/User.php`: relasi `signatureFile()` (`belongsTo(File::class, 'signature_file_id')`) dan `hasSignature(): bool`
- [x] 3. `User`: tambah `signature_file_id` ke `$hidden` (NFR3) dan ke `$configColumns` dengan `'ignore' => true` supaya tidak muncul sebagai kolom DataTable
- [x] 4. `UserFactory`: state `withSignature()` yang membuat `File` PNG dummy dan menautkannya, untuk dipakai test T07 dan T08

## T02: Exception & Kalkulator Ambang

- [x] 5. `app/Exceptions/User/SignatureProcessingException.php`: named constructor `unreadableImage()`, `unsupportedFormat()`, `noSignatureDetected()`, `imageTooDark()`, masing-masing membawa kunci terjemahan sendiri
- [x] 6. `lang/en/user/signature.php` + `lang/id/user/signature.php`: pesan kesalahan T02.5, label bagian profil, label tombol, label blok GrapesJS
- [x] 7. `app/Services/User/Signature/SignatureThresholdCalculator.php`: `buildThresholdMap(array $luminance, int $w, int $h): array` dengan blok 32 px dan rumus `mean − 0.6 × stddev`; `thresholdAt(array $map, int $x, int $y): float` dengan interpolasi bilinear antar blok tetangga
- [x] 8. `tests/Unit/User/Signature/SignatureThresholdCalculatorTest.php`: peta ambang pada masukan seragam, interpolasi menghasilkan nilai antara dua ambang blok, perilaku di tepi gambar saat blok tetangga tidak lengkap

## T03: Pipeline Pemrosesan Gambar

- [x] 9. `app/Services/User/Signature/SignatureImageService.php` kerangka: `process(string $imageBytes): string` memanggil delapan langkah privat sesuai design bagian 3
- [x] 10. Langkah decode + downscale: `imagecreatefromstring()` dengan `false` dilempar sebagai `unreadableImage()`; `imagescale()` proporsional bila sisi mana pun melebihi 4000 px
- [x] 11. Langkah `hasAlphaChannel()`: sampling ber-step (bukan pemindaian penuh) pada truecolor, `imagecolortransparent()` pada palette. Gambar beralpha melewati threshold
- [x] 12. Langkah `removeBackground()`: peta kecerahan → `SignatureThresholdCalculator` → alpha bergradasi `127 * min(1, lum / threshold)` pada piksel tinta, transparan penuh pada sisanya. Warna tinta asli dipertahankan. **Patuhi tiga batasan performa di design bagian 3**: susun warna sebagai integer `($alpha << 24) | ($r << 16) | ($g << 8) | $b` (JANGAN `imagecolorallocatealpha()` di dalam loop), peta kecerahan pakai `SplFixedArray` datar (JANGAN array 2D), dan ambang dihitung per baris (JANGAN `thresholdAt()` per piksel)
- [x] 13. Langkah `assertMeaningful()`: dipanggil **SEBELUM** `trim()`. Rasio piksel opak dihitung pada frame penuh; nol piksel → `noSignatureDetected()`, di atas 0.9 → `imageTooDark()`. Urutan ini wajib: mengukur setelah trim menolak TTD bergaris tebal, karena bounding box memang rapat terhadap goresan. Beri komentar alasannya di kode
- [x] 14. Langkah `trim()`: buang baris dan kolom terluar yang sepenuhnya transparan, crop ke bounding box. Tidak perlu menangani gambar kosong, sudah dijamin task 13
- [x] 15. Langkah `normalizeHeight()` + `encodePng()`: perkecil ke tinggi maksimum 200 px tanpa pernah memperbesar; `imagesavealpha(true)` sebelum `imagepng()`
- [x] 16. `tests/Unit/User/Signature/SignatureImageServiceTest.php` dengan fixture dibangkitkan programatik lewat GD (bukan berkas biner di repo): sebelas kasus pada tabel design bagian 10

**Checkpoint 1** — jalankan `php artisan test --compact tests/Unit/User/Signature/`. Pipeline harus lulus sepenuhnya sebelum lanjut, karena seluruh task berikutnya bergantung padanya.

## T04: Endpoint Simpan & Hapus TTD

- [x] 17. `app/Http/Requests/User/SignatureUploadRequest.php`: validasi berkas maksimum 5 MB, tipe MIME diperiksa dari isi berkas, dan penanda `source` bernilai `upload` atau `canvas`
- [x] 18. `UserController::signature()`: proses lewat `SignatureImageService` bila `source=upload`, lewati threshold bila `source=canvas`; simpan sebagai `File` dengan `is_public = false` **dipaksa server** (nilai dari request diabaikan); hapus `File` TTD lama beserta berkas fisiknya
- [x] 19. `UserController::removeSignature()`: null-kan kolom dan hapus `File` beserta berkas fisiknya
- [x] 20. `UserController::exceptPermission()`: cabang khusus `signature`/`removeSignature` yang mengembalikan `$user_id === Auth::id()`. **Sengaja tidak mengikuti pola `image`** — beri komentar alasannya di kode. `enforcePermission()` tidak diberi entri untuk method ini
- [x] 21. `routes/web.php`: `POST`, `DELETE`, dan `GET` pada `/users/{user}/signature`, ditempatkan bersebelahan dengan route `users.image`

## T05: Akses Berkas TTD

- [x] 22. `app/Services/Core/Approval/ApprovalAccessService.php`: pindahkan logika `canAccessApprovalInstance()` dari `ApprovalInstanceController` ke service tanpa mengubah perilakunya
- [x] 23. `ApprovalInstanceController`: panggil service T05.22, hapus method privatnya
- [x] 24. `UserController::showSignature()`: 404 bila tidak ada TTD; 403 kecuali pemohon adalah pemilik akun atau berhak melihat suatu `ApprovalInstance` tempat pemilik TTD tercatat sebagai `acted_by_id`; sajikan dengan `Cache-Control: private`

**Checkpoint 2** — jalankan `php artisan test --compact --filter=ApprovalInstance` untuk memastikan ekstraksi T05.22 tidak mengubah perilaku approval yang sudah ada.

## T06: Resolver & Helper Handlebars

- [x] 25. `app/Services/Core/Approval/SignatureResolverService.php` — `resolveFinalStep()`: pilih step berstatus `APPROVED` dengan `sequence` terbesar **dan** `acted_by_id` tidak null. Saring **di memori** dari koleksi `steps` yang sudah ter-eager-load, bukan lewat query baru. Beri komentar kenapa bukan `max(sequence)` dari seluruh step
- [x] 26. `SignatureResolverService::resolveFinalSignature(Model $document): ?array`: kembalikan `image` (data URI base64), `name`, `date`, `hasSignature`; `null` bila tidak ada step approved. Approver diambil dari `acted_by_id`, **bukan** `approverable_id`
- [x] 27. `PrintTemplateRenderService::renderSignatureSlot()`: method biasa di dalam namespace, menghasilkan HTML slot, memakai fallback nama + tanggal bila `hasSignature` false. Abaikan argumen posisional bila diterima (template lama), jangan gagal
- [x] 28. `PrintTemplateRenderService::helpers()`: daftarkan `approvalSignature` **tanpa argumen posisional** — `$options` jadi parameter pertama. Closure **wajib** sintaks `function (...)` dan **dilarang** menyebut nama kelas apa pun; seluruh isi didelegasikan ke `$this->renderSignatureSlot()`. Lihat catatan panjang di berkas itu
- [x] 29. `resources/js/lib/initHandlebar.js`: daftarkan helper `approvalSignature` berperilaku identik; data contoh menghasilkan placeholder data URI SVG, bukan kosong
- [x] 30. `AttachGeneratedPdfJob::handle()`: `loadMissing('approvalable.steps.actedBy.signatureFile')` pada dokumen. Job memakai `SerializesModels` sehingga relasi dari request tidak terbawa
- [x] 31. `tests/Feature/Core/ApprovalSignatureRenderTest.php`: sepuluh skenario pada tabel design bagian 10. Prioritaskan kasus "step 3 WAITING, step 2 approved" dan "step terakhir approved tanpa acted_by_id" — keduanya yang membedakan implementasi benar dari `max(sequence)` naif
- [x] 32. `tests/Feature/Core/ApprovalSignatureHelperParityTest.php`: satu potongan template dirender lewat kedua jalur dengan data sama, hasilnya dibandingkan
- [x] 33. `tests/Feature/Core/PdfSignatureRenderTest.php`: kunci perilaku `isAllowedResourceUrl()` yang meloloskan `data:` URI, dan pastikan PNG transparan bertahan pada jalur dompdf

## T07: Frontend — Profil

- [ ] 34. `resources/js/Pages/Users/ManageUsers/SignatureField.jsx`: pratinjau di atas latar checkerboard CSS gradient, tombol Unggah, Gambar, dan Hapus. Hanya dirender bila `user.id === auth.user.id`
- [ ] 35. `resources/js/Pages/Users/ManageUsers/SignatureCanvas.jsx`: event pointer terpadu, `touch-action: none`, konteks transparan, skala mengikuti `devicePixelRatio`, tombol simpan terkunci selama `hasStroke` false
- [ ] 36. `Users/ManageUsers/Show.jsx`: pasang `SignatureField` di bawah bagian foto profil
- [ ] 37. `SignatureCanvas.rtl.test.jsx`: tombol simpan nonaktif saat kosong, aktif setelah goresan, nonaktif lagi setelah dibersihkan
- [ ] 38. `SignatureField.rtl.test.jsx`: pratinjau muncul saat TTD ada, tombol hapus tersembunyi saat tidak ada TTD

## T08: Feature Test Endpoint

- [ ] 39. `tests/Feature/User/UserSignatureTest.php`: pemilik akun dapat unggah, ganti, dan hapus
- [ ] 40. Test otorisasi: user **dengan** permission `write` pada `User` tetap ditolak 403 saat mengubah TTD orang lain. **Ini test terpenting di berkas ini** — titik tempat fitur sengaja menyimpang dari pola `image`
- [ ] 41. Test: `is_public` tetap false meskipun request mengirim `isPublic=true`; berkas asli hasil upload tidak tersisa di storage
- [ ] 42. Test: mengganti TTD menghapus berkas lama; `signature_file_id` tidak muncul di response daftar user; permintaan berkas tanpa sesi login ditolak

## T09: Blok GrapesJS

- [ ] 43. `resources/js/lib/gjsSignature.js`: component type `approval-signature` dengan trait `showName` dan `showDate` saja — **tanpa** trait `sequence` (FR8a); block berlabel Tanda Tangan pada kategori Approval
- [ ] 44. `toHTML()` komponen menerjemahkan trait menjadi pemanggilan `{{approvalSignature}}` yang bertahan melewati serialisasi editor dan tetap dapat diedit di mode kode
- [ ] 45. `Editor.jsx`: daftarkan plugin pada array `plugins`, bersebelahan dengan `gjsStaticHTML`
- [ ] 46. `gjsSignature.test.js`: trait terserialisasi ke markup yang benar, dan markup terbaca kembali menjadi trait yang sama (round-trip)

**Checkpoint 3** — jalankan seluruh suite: `php artisan test --compact` dan `npm run test`. Konfirmasi ke user sebelum masuk T10.

## T10: Finalisasi

- [ ] 47. Verifikasi manual PDF: dokumen dengan tiga step approval yang seluruhnya approved, pastikan **hanya** TTD step terakhir yang tercetak. Ulangi dengan penandatangan final tanpa TTD untuk memeriksa fallback, pada kedua jalur renderer
- [ ] 48. Jalankan `vendor/bin/pint --dirty --format agent` dan `npm run lint`
- [ ] 49. Jalankan `npm run build` — sesuai preferensi tersimpan, build frontend ditunda sampai seluruh rangkaian selesai, bukan per-task
- [ ] 50. `graphify update .`

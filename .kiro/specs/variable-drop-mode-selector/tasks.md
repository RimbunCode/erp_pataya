# Tasks: Variable Drop Mode Selector

Rencana tugas implementasi asinkron dialog pilihan format drop/insert variabel.

---

## Pre-requisites & Codebase Analysis

- [x] Pastikan dependensi GrapesJS React terinstal dan fungsional
- [x] Analisis komponen dialog Radix UI/shadcn yang sudah ada di `resources/js/Components/ui/dialog.jsx`

---

## Tasks

- [ ] **T1: Implementasi Komponen Dialog (`DropModeDialog.jsx`)**
  - Buat file `resources/js/Pages/Core/PrintTemplate/Components/DropModeDialog.jsx`
  - Gunakan `@/Components/ui/dialog` untuk modal popup yang responsif dan compact
  - Desain tombol pilihan: "Label Only", "Token Only", "Both (Label + Token)"
  - Dukung dynamic options hiding (sembunyikan opsi "Both" jika target adalah `gjsSubGrid`)
  - Pastikan style serasi dengan antarmuka editor yang gelap/terang (Tailwind classes)
  - _Requirements: FR-1.1, FR-1.2, FR-2.1, FR-2.2, FR-2.3_

- [ ] **T2: Buat Fungsi Pembangun Komponen Independen (`variableInsertUtils.js`)**
  - Refactor/tambahkan fungsi pembangun komponen di `resources/js/Pages/Core/PrintTemplate/utils/variableInsertUtils.js`
  - Buat fungsi `buildLabelComponent(payload)` untuk mode Label Only
  - Buat fungsi `buildTokenComponent(payload)` untuk mode Token Only
  - Buat fungsi `buildSubGridComponent(payload)` untuk mode Both (Label + Token)
  - _Requirements: FR-3.1, FR-3.2, FR-3.3_

- [ ] **T3: Setup Asynchronous Drop Interceptor (`variableDropUtils.js`)**
  - Modifikasi `resources/js/Pages/Core/PrintTemplate/utils/variableDropUtils.js`
  - Intersepsi event `canvas:drop`
  - Deteksi target drop di bawah koordinat kursor drop
  - Panggil callback bridge asinkron `onDropModeRequest` dengan payload variabel dan daftar mode yang valid
  - Jika dibatalkan, hapus placeholder atau panggil `editor.UndoManager.undo()` jika diperlukan
  - Jika sukses, panggil builder yang sesuai dan tambahkan ke target canvas menggunakan editor API
  - _Requirements: FR-1.1, FR-2.1, FR-2.2, FR-2.3, FR-4.1, FR-4.2, FR-5.1_

- [ ] **T4: Integrasikan Drop Mode Bridge di Editor Halaman (`Editor.jsx`)**
  - Modifikasi `resources/js/Pages/Core/PrintTemplate/Editor.jsx`
  - Tambahkan state React untuk mengontrol visibilitas dialog (`dropModalOpen`, `dropModalConfig`)
  - Implementasikan wrapper `onDropModeRequest` yang mengembalikan promise asinkron
  - Render komponen `DropModeDialog` di root tingkat Editor dan hubungkan ke state tersebut
  - _Requirements: FR-1.1, FR-2.1_

- [ ] **T5: Terapkan Dialog pada Klik-untuk-Sisip (`VariableItem.jsx`)**
  - Modifikasi `resources/js/Pages/Core/PrintTemplate/Components/VariableItem.jsx`
  - Hubungkan fungsi `handleInsert()` dengan callback `onDropModeRequest`
  - Tampilkan dialog sebelum melakukan proses penyisipan komponen ke canvas
  - _Requirements: FR-1.2, FR-1.3_

- [ ] **T6: Validasi, Pengujian, dan Penyelesaian Linting**
  - Tulis test unit/feature untuk builder fungsi baru di `variableInsertUtils.property.test.js`
  - Jalankan formatter kode Pint: `vendor/bin/pint --dirty --format agent`
  - Jalankan ESLint linter: `npm run lint`
  - Verifikasi seluruh perubahan berhasil dibangun (`npm run build`)
  - _Requirements: NFR-1, NFR-2_

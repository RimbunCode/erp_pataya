# Requirements Document

## Introduction

Chart saat ini selalu menampilkan angka penuh tanpa opsi disingkat, berbeda dari NumberCard yang sudah punya toggle `show_full_number`. Selain menambahkan parity tersebut ke Chart, investigasi menemukan bahwa format compact NumberCard yang sudah ada juga punya masalah locale: mengikuti locale default browser/OS, bukan lang aktif aplikasi (id/en) — dua sistem locale yang berjalan independen. Spec ini menutup KEDUA gap sekaligus: menambahkan toggle full/compact ke Chart, dan menyelaraskan format angka (Chart + NumberCard) supaya mengikuti lang aktif aplikasi.

## Glossary

- **Compact notation**: representasi angka disingkat pakai unit (mis. "1,2 rb", "1.2K") via `Intl.NumberFormat` dengan `notation: "compact"`.
- **Lang aktif**: locale (`id`/`en`) yang sedang dipakai aplikasi, ditentukan cookie `lang` dan dibaca via `useLaravelReactI18n().currentLocale()` — terpisah dari locale browser/OS.
- **Titik tampilan angka**: lokasi UI yang me-render nilai numerik chart — axis Y, tooltip hover, label tengah donut.

## Requirements

### Requirement 1: Toggle full/compact number pada Chart

**User Story:** As a pengguna dashboard, I want mengatur apakah angka di Chart ditampilkan penuh atau disingkat, so that saya bisa menyesuaikan kepadatan tampilan chart seperti yang sudah bisa saya lakukan di NumberCard.

#### Acceptance Criteria

1. THE `charts` table SHALL punya kolom `show_full_number` boolean dengan default `false`.
2. WHEN Chart baru dibuat tanpa mengisi `show_full_number`, THE sistem SHALL menyimpan `false` (compact by default), bukan error atau null yang ambigu.
3. THE halaman Form Chart SHALL menampilkan checkbox "Tampilkan Angka Penuh" dengan deskripsi penjelas, mengikuti pola visual checkbox standalone (`FormCheckbox` dengan `label` sendiri, TIDAK dibungkus `FormInput`) yang sudah diperbaiki di NumberCard/Chart form pada sesi ini.
4. WHEN `show_full_number` bernilai `true`, THE Chart SHALL menampilkan angka penuh dengan pemisah ribuan di SEMUA titik tampilan angka (axis, tooltip, label donut).
5. WHEN `show_full_number` bernilai `false` (atau tidak diset), THE Chart SHALL menampilkan angka dalam notasi compact di SEMUA titik tampilan angka.

### Requirement 2: Satu sumber format angka bersama (Chart + NumberCard)

**User Story:** As a developer yang merawat kode ini, I want logic format angka (full/compact + locale) berada di satu tempat, so that perilaku format konsisten di seluruh dashboard dan tidak perlu diperbaiki dua kali kalau ada bug.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan satu fungsi format angka murni (`formatNumber`) di `resources/js/lib/numberFormat.js`, menerima `value` dan opsi `{full, locale}`.
2. THE fungsi `formatNumber` SHALL TIDAK punya dependency ke React atau hook apa pun (pure function), supaya bisa diuji unit test tanpa render komponen.
3. THE `ChartDisplay.jsx` SHALL memakai `formatNumber` dari `lib/numberFormat.js` untuk SEMUA titik tampilan angka (axis, tooltip, label donut) — bukan implementasi format terpisah per titik.
4. THE `NumberCardDisplay.jsx` SHALL memakai `formatNumber` yang SAMA (bukan lagi implementasi lokalnya sendiri).

### Requirement 3: Format angka mengikuti lang aktif aplikasi, bukan locale browser

**User Story:** As a pengguna aplikasi yang sudah mengatur bahasa ke Indonesia, I want notasi singkat angka (mis. "rb"/"jt") juga mengikuti bahasa itu, so that tampilan angka konsisten dengan teks UI lain, terlepas dari setting bahasa browser/OS perangkat saya.

#### Acceptance Criteria

1. WHEN lang aktif aplikasi adalah `id`, THE Chart dan NumberCard SHALL menampilkan notasi compact dalam format locale Indonesia (mis. "1,2 rb"), TERLEPAS dari locale browser/OS pengguna.
2. WHEN lang aktif aplikasi adalah `en`, THE Chart dan NumberCard SHALL menampilkan notasi compact dalam format locale Inggris (mis. "1.2K"), TERLEPAS dari locale browser/OS pengguna.
3. WHEN lang aktif aplikasi berubah (mis. via `setLocale()`) SELAGI pengguna sedang melihat dashboard, THE tampilan angka pada re-render berikutnya SHALL mengikuti locale baru.

### Requirement 4: Kompatibilitas mundur untuk Chart yang sudah ada

**User Story:** As a pengguna dengan Chart yang sudah dibuat sebelum fitur ini ada, I want Chart lama saya tetap tampil normal tanpa perlu saya konfigurasi ulang, so that tidak ada chart yang tiba-tiba rusak atau berubah drastis setelah update.

#### Acceptance Criteria

1. WHEN Chart lama (dibuat sebelum kolom `show_full_number` ada) dimuat, THE sistem SHALL memperlakukannya sebagai `show_full_number=false` (compact) via default kolom migration, TANPA perlu skrip backfill data manual.
2. IF frontend menerima `chart.show_full_number` bernilai `undefined` (race loading/props belum lengkap), THEN THE `formatNumber` SHALL tetap render compact (fallback aman), BUKAN crash atau menampilkan "NaN".

### Requirement 5: Perubahan axis Y tidak merusak layout chart existing

**User Story:** As a pengguna dashboard, I want penambahan axis Y (yang sebelumnya tidak dirender eksplisit) tidak membuat chart yang sudah saya susun jadi berantakan, so that pengalaman visual dashboard tetap rapi setelah update.

#### Acceptance Criteria

1. THE Bar dan Line chart SHALL menampilkan `YAxis` eksplisit dengan `tickFormatter` yang memanggil `formatNumber`.
2. THE penambahan `YAxis` tersebut SHALL diverifikasi visual secara manual di browser (bukan cuma test otomatis) sebelum task terkait ditandai selesai, karena berpotensi mengubah proporsi layout chart bar/line yang sudah ada.

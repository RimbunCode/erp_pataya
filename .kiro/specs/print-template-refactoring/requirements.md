# Requirements Document

## Introduction

Refactoring modul PrintTemplate (`resources/js/Pages/Core/PrintTemplate/`) untuk membersihkan duplikasi fungsi/variabel, memecah file besar menjadi modul-modul kecil yang lebih maintainable, dan menambahkan komentar dalam Bahasa Indonesia agar lebih mudah dipahami oleh tim developer.

## Glossary

- **PrintTemplate_Module**: Keseluruhan direktori `resources/js/Pages/Core/PrintTemplate/` beserta sub-direktori `Components/`, `utils/`, dan `Components/StyleFields/`
- **Editor**: Komponen utama halaman editor template cetak (`Editor.jsx`)
- **Shared_Utils**: Modul utilitas bersama yang berisi fungsi-fungsi reusable yang digunakan di banyak file
- **Duplikasi_Fungsi**: Fungsi atau konstanta yang didefinisikan lebih dari satu kali di file berbeda dengan logika yang identik atau hampir identik
- **Komentar_Indonesia**: Komentar kode dalam Bahasa Indonesia yang menjelaskan tujuan, parameter, dan perilaku dari fungsi atau blok kode

## Requirements

### Requirement 1: Eliminasi Duplikasi Fungsi `buildVariableToken`

**User Story:** Sebagai developer, saya ingin fungsi `buildVariableToken` hanya didefinisikan di satu tempat, sehingga perubahan logika token hanya perlu dilakukan sekali.

#### Acceptance Criteria

1. THE Shared_Utils SHALL menyediakan satu definisi tunggal fungsi `buildVariableToken` yang menerima parameter `{variableType, parentType, variablePath, keyName}` dan mengembalikan string token, di-export sebagai named export dari modul utilitas bersama dalam direktori `PrintTemplate`
2. THE PrintTemplate_Module SHALL mengimpor fungsi `buildVariableToken` dari modul utilitas bersama yang sama di setiap file yang memanggilnya, termasuk `Editor.jsx` dan `VariableItem.jsx`
3. THE PrintTemplate_Module SHALL tidak memiliki definisi lokal fungsi `buildVariableToken` di file manapun selain modul utilitas bersama setelah refactoring
4. WHEN fungsi `buildVariableToken` dipanggil dengan parameter yang sama seperti sebelum refactoring, THE Shared_Utils SHALL menghasilkan output string token yang identik dengan implementasi sebelumnya untuk setiap kombinasi input yang valid

### Requirement 2: Eliminasi Duplikasi Fungsi `getSimplifiedTokenDisplay`

**User Story:** Sebagai developer, saya ingin fungsi `getSimplifiedTokenDisplay` hanya didefinisikan di satu tempat, sehingga logika penyederhanaan token konsisten di seluruh modul.

#### Acceptance Criteria

1. THE Shared_Utils SHALL menyediakan satu definisi tunggal fungsi `getSimplifiedTokenDisplay` yang di-export dari modul `tokenConfigHelpers.js` dengan signature `(token: string, variablePath?: string) => string`
2. THE PrintTemplate_Module SHALL mengimpor `getSimplifiedTokenDisplay` dari `tokenConfigHelpers.js` di setiap file yang memanggilnya, termasuk `Editor.jsx` dan `VariableItem.jsx`
3. THE PrintTemplate_Module SHALL tidak memiliki definisi inline atau lokal dari fungsi `getSimplifiedTokenDisplay` di file manapun setelah refactoring
4. WHEN `getSimplifiedTokenDisplay` dipanggil dengan token kosong dan variablePath berisi prefix `doc.`, THE Shared_Utils SHALL mengembalikan string dalam format `{{<path tanpa prefix doc.>}}`
5. WHEN `getSimplifiedTokenDisplay` dipanggil dengan token yang mengandung `formatCurrency` atau `formatNumber`, THE Shared_Utils SHALL mengembalikan string dalam format `{{<field name>}}` yang diekstrak dari token tersebut

### Requirement 3: Eliminasi Duplikasi Fungsi `normalizePropertyId`

**User Story:** Sebagai developer, saya ingin fungsi `normalizePropertyId` hanya didefinisikan di satu tempat, sehingga normalisasi property ID konsisten.

#### Acceptance Criteria

1. THE Shared_Utils SHALL menyediakan satu definisi tunggal fungsi `normalizePropertyId` yang di-export sebagai named export dari `utils/styleManagerUtils.js`
2. THE CustomStyleManager SHALL mengimport fungsi `normalizePropertyId` dari `utils/styleManagerUtils.js` menggunakan named import
3. THE PrintTemplate_Module SHALL tidak memiliki definisi lokal fungsi `normalizePropertyId` di dalam file `CustomStyleManager.jsx`
4. WHEN fungsi `normalizePropertyId` yang diimport dipanggil dengan input berupa property ID string, THE Shared_Utils SHALL menghasilkan output yang identik dengan implementasi lokal sebelumnya (lowercase, trimmed, tanpa perubahan logika normalisasi)

### Requirement 4: Eliminasi Duplikasi Fungsi `escapeRegExp`

**User Story:** Sebagai developer, saya ingin fungsi `escapeRegExp` hanya didefinisikan di satu tempat, sehingga tidak ada duplikasi utilitas regex.

#### Acceptance Criteria

1. THE Shared_Utils SHALL menyediakan satu definisi tunggal fungsi `escapeRegExp` yang di-export sebagai named export dari `utils/cssUtils.js`
2. WHEN `utils/manualCssRuleUtils.js` membutuhkan fungsi `escapeRegExp`, THE manualCssRuleUtils SHALL mengimport fungsi tersebut dari `utils/cssUtils.js` dan tidak memiliki definisi lokal fungsi `escapeRegExp` di dalam file-nya
3. THE PrintTemplate_Module SHALL memiliki tepat satu definisi fungsi `escapeRegExp` di seluruh direktori `utils/`, yaitu di file `utils/cssUtils.js`
4. WHEN fungsi `escapeRegExp` dipanggil setelah refactoring, THE Shared_Utils SHALL menghasilkan output yang identik dengan implementasi sebelumnya, yaitu meng-escape karakter regex spesial `[.*+?^${}()|[\]\\]` dari string input

### Requirement 5: Pemecahan File `Editor.jsx` Menjadi Modul Lebih Kecil

**User Story:** Sebagai developer, saya ingin file `Editor.jsx` dipecah menjadi modul-modul yang lebih kecil, sehingga lebih mudah dibaca dan di-maintain.

#### Acceptance Criteria

1. THE PrintTemplate_Module SHALL memindahkan fungsi `variableDropListener` dan helper internalnya ke file utilitas terpisah `utils/variableDropUtils.js` sebagai named exports
2. THE PrintTemplate_Module SHALL memindahkan fungsi `mountLetterheadPreview` ke file utilitas terpisah `utils/letterheadPreviewUtils.js` sebagai named export
3. THE PrintTemplate_Module SHALL memindahkan fungsi `stripEditorOnlyWrapperStyles` dan `getCurrentTemplateFromEditor` ke file utilitas terpisah `utils/templateExportUtils.js` sebagai named exports
4. THE PrintTemplate_Module SHALL memindahkan fungsi-fungsi helper murni (`clampSidebarWidth`, `resolveTemplateUnitCode`, `parseNumericValue`, `validateHandlebarTemplate`) ke file utilitas terpisah `utils/editorHelpers.js` sebagai named exports
5. WHEN semua fungsi telah dipindahkan ke modul terpisah, THE Editor.jsx SHALL mengimport seluruh fungsi yang dipindahkan menggunakan named import dari modul baru masing-masing, dan tidak mendefinisikan ulang fungsi tersebut secara lokal
6. THE PrintTemplate_Module SHALL memastikan tidak ada circular dependency antara file-file utilitas baru dan `Editor.jsx`, dimana setiap modul utilitas hanya boleh mengimport dari library eksternal atau dari modul utilitas lain yang tidak mengimport balik ke modul tersebut

### Requirement 6: Pemecahan File `VariableItem.jsx` Menjadi Modul Lebih Kecil

**User Story:** Sebagai developer, saya ingin file `VariableItem.jsx` dipecah menjadi modul-modul yang lebih kecil, sehingga logika bisnis terpisah dari komponen UI.

#### Acceptance Criteria

1. THE PrintTemplate_Module SHALL memindahkan fungsi-fungsi helper (`formatColumnValue`, `getFormattedHandlebarToken`, `isFormattableType`, `resolveExampleValue`, `getHandlebarToken`, `getDisplayLabel`) ke file `utils/variableTokenUtils.js` sebagai named exports
2. THE PrintTemplate_Module SHALL memindahkan fungsi-fungsi encoding/escaping (`encodeTokenToBase64`, `escapeAttributeValue`, `simplifyInlineDisplayToken`) ke file `utils/variableEncodingUtils.js` sebagai named exports
3. THE PrintTemplate_Module SHALL memindahkan fungsi `tryInsertInlineVariableToken`, `buildVariableDragPayload`, dan `buildVariableToken` ke file `utils/variableInsertUtils.js` sebagai named exports
4. THE VariableItem.jsx SHALL mengimport semua fungsi yang dipindahkan dari modul-modul baru menggunakan named imports, dan file tersebut hanya berisi komponen React `VariableItem` beserta logic state/hooks-nya
5. THE PrintTemplate_Module SHALL menempatkan file utilitas baru di dalam direktori `resources/js/Pages/Core/PrintTemplate/utils/` mengikuti konvensi penamaan file yang sudah ada (camelCase dengan suffix `Utils.js`)

### Requirement 7: Penambahan Komentar Bahasa Indonesia pada Modul Utilitas

**User Story:** Sebagai developer Indonesia, saya ingin semua file utilitas memiliki komentar dalam Bahasa Indonesia, sehingga lebih mudah dipahami oleh tim.

#### Acceptance Criteria

1. THE Shared_Utils SHALL memiliki komentar header file dalam Bahasa Indonesia berupa blok JSDoc di bagian atas file yang mencantumkan deskripsi tujuan modul dalam minimal 1 kalimat dan maksimal 3 kalimat
2. WHEN sebuah fungsi di-export dari modul utilitas, THE fungsi tersebut SHALL memiliki JSDoc block dalam Bahasa Indonesia yang mencantumkan deskripsi tujuan fungsi, tag @param untuk setiap parameter beserta penjelasannya, dan tag @returns yang menjelaskan nilai kembalian
3. WHEN sebuah blok kode mengandung percabangan kondisional bertingkat (2 level atau lebih) atau loop dengan manipulasi data di dalamnya, THE blok kode tersebut SHALL memiliki komentar inline dalam Bahasa Indonesia minimal 1 baris sebelum blok tersebut yang menjelaskan alur logika
4. IF komentar header file atau JSDoc block ditulis dalam bahasa selain Bahasa Indonesia, THEN THE Shared_Utils SHALL dianggap tidak memenuhi kriteria dan komentar tersebut harus diganti ke Bahasa Indonesia

### Requirement 8: Penambahan Komentar Bahasa Indonesia pada Komponen React

**User Story:** Sebagai developer Indonesia, saya ingin semua komponen React memiliki komentar dalam Bahasa Indonesia, sehingga lebih mudah dipahami oleh tim.

#### Acceptance Criteria

1. WHEN sebuah komponen React di-export dari modul PrintTemplate, THE komponen tersebut SHALL memiliki komentar header berformat JSDoc dalam Bahasa Indonesia yang mencantumkan: deskripsi tujuan komponen (minimal 1 kalimat) dan daftar semua props yang diterima komponen beserta tipe datanya
2. WHEN sebuah hook `useEffect` atau `useCallback` digunakan dalam komponen PrintTemplate, THE hook tersebut SHALL memiliki komentar inline dalam Bahasa Indonesia tepat di atas hook yang menjelaskan: kondisi pemicu (dependency array) dan alasan hook tersebut diperlukan
3. WHEN sebuah event handler dalam komponen PrintTemplate memiliki lebih dari 3 statement atau mengandung percabangan kondisional, THE handler tersebut SHALL memiliki komentar dalam Bahasa Indonesia di atas deklarasi handler yang menjelaskan alur eksekusi dan kemungkinan efek samping
4. THE komentar Bahasa Indonesia pada komponen PrintTemplate SHALL menggunakan format komentar blok (`/** */`) untuk header komponen dan format komentar baris (`//`) untuk komentar inline pada hook dan handler

### Requirement 9: Konsistensi Import dan Export

**User Story:** Sebagai developer, saya ingin semua import dan export mengikuti pola yang konsisten, sehingga mudah ditelusuri.

#### Acceptance Criteria

1. THE PrintTemplate_Module SHALL menggunakan named export untuk semua fungsi utilitas, yaitu setiap fungsi atau konstanta yang didefinisikan dalam file `.js` di dalam direktori `utils/` maupun file helper `.js` di dalam direktori `Components/` (contoh: `tokenConfigHelpers.js`)
2. THE PrintTemplate_Module SHALL menggunakan default export hanya untuk komponen React, yaitu setiap file `.jsx` yang me-return JSX sebagai export utamanya, baik komponen halaman (page) maupun sub-komponen
3. WHEN sebuah fungsi digunakan di lebih dari satu file dalam modul PrintTemplate, THE fungsi tersebut SHALL didefinisikan dan di-named-export dari satu file sumber tunggal di dalam direktori `utils/`, dan setiap file yang membutuhkan SHALL meng-import langsung dari file sumber tersebut tanpa menduplikasi definisi fungsi
4. IF sebuah file `.jsx` perlu meng-export fungsi helper selain komponen utamanya, THEN THE file tersebut SHALL menggunakan default export untuk komponen React dan named export untuk fungsi helper tambahan

### Requirement 10: Preservasi Fungsionalitas

**User Story:** Sebagai developer, saya ingin refactoring tidak mengubah perilaku aplikasi, sehingga semua fitur tetap berjalan seperti sebelumnya.

#### Acceptance Criteria

1. THE PrintTemplate_Module SHALL mempertahankan semua public API (export) yang sudah ada sebelum refactoring
2. WHEN refactoring selesai, THE PrintTemplate_Module SHALL lolos build (`npm run build`) tanpa error
3. IF sebuah fungsi dipindahkan ke modul baru, THEN THE modul lama SHALL tetap meng-export fungsi tersebut melalui re-export jika ada consumer eksternal di luar direktori PrintTemplate

### Requirement 11: Eliminasi Duplikasi Konstanta Grid/SubGrid

**User Story:** Sebagai developer, saya ingin konstanta CSS grid (`GRID_CLASS`, `SUBGRID_CLASS`, `GRID_RULE_STYLE`, `SUBGRID_RULE_STYLE`) hanya didefinisikan di satu tempat, sehingga perubahan style grid hanya perlu dilakukan sekali.

#### Acceptance Criteria

1. THE Shared_Utils SHALL menyediakan satu definisi tunggal untuk konstanta `GRID_CLASS`, `SUBGRID_CLASS`, `GRID_RULE_STYLE`, dan `SUBGRID_RULE_STYLE` yang di-export dari modul utilitas bersama, dengan nilai yang identik dengan nilai konstanta yang sebelumnya didefinisikan secara lokal di file consumer
2. THE `Editor.jsx` (dalam `variableDropListener`) dan `VariableItem.jsx` (dalam `handleInsert`) SHALL mengimport konstanta `GRID_CLASS`, `SUBGRID_CLASS`, `GRID_RULE_STYLE`, dan `SUBGRID_RULE_STYLE` dari Shared_Utils dan tidak mendeklarasikan ulang konstanta tersebut secara lokal
3. THE PrintTemplate_Module SHALL tidak memiliki definisi inline atau lokal (termasuk deklarasi `const`, assignment, atau literal duplikat) dari konstanta `GRID_CLASS`, `SUBGRID_CLASS`, `GRID_RULE_STYLE`, dan `SUBGRID_RULE_STYLE` di seluruh file dalam direktori modul PrintTemplate
4. WHEN developer mengubah nilai salah satu konstanta grid di Shared_Utils, THE perubahan tersebut SHALL langsung berlaku di semua file consumer tanpa memerlukan perubahan tambahan di file lain

### Requirement 12: Penghapusan Console.log yang Tidak Diperlukan

**User Story:** Sebagai developer, saya ingin kode produksi tidak memiliki `console.log` debugging yang tertinggal, sehingga output console tetap bersih.

#### Acceptance Criteria

1. THE PrintTemplate_Module SHALL tidak mengandung statement `console.log` aktif (tidak di-comment) di seluruh file dalam direktori `Pages/Core/PrintTemplate` dan subdirektorinya, termasuk namun tidak terbatas pada `VariableManager.jsx`, `TokenConfigurationManager.jsx`, `StylePropertyField.jsx`, dan `RelationsInspector.jsx`
2. THE PrintTemplate_Module SHALL mempertahankan semua statement `console.error` yang berada di dalam blok `catch` atau callback `.catch()` untuk keperluan pencatatan error pada operasi yang dapat gagal (parsing JSON, pemanggilan API, ekstraksi template)
3. WHEN kode yang di-comment mengandung `console.log` (dead code), THE PrintTemplate_Module SHALL menghapus blok komentar tersebut jika seluruh blok komentar merupakan kode yang tidak aktif dan tidak memiliki rencana penggunaan kembali yang terdokumentasi

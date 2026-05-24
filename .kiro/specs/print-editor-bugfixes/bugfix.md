# Bugfix Requirements Document

## Introduction

Dokumen ini mendefinisikan perbaikan bug pada PrintTemplate Editor yang mencakup 4 masalah utama:

1. Drag and drop dari Block panel dan VariableItem panel ke canvas tidak berfungsi
2. Fitur Manual CSS tidak menyediakan defaultValue berupa `#<node_id>{ }` saat node tertentu dipilih
3. Format CSS harus menggunakan kebab-case (snake-case dengan dash) sesuai konvensi penamaan CSS standar
4. Keyboard shortcut Ctrl+S belum tersedia pada modal Manual CSS dan modal Static HTML untuk menyimpan

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN pengguna men-drag block dari Block panel (CustomBlockManager) ke canvas THEN sistem tidak merespons drop event dan block tidak ter-insert ke canvas karena HTML5 drag-and-drop API tidak terintegrasi dengan GrapesJS internal sorter/drag system

1.2 WHEN pengguna men-drag VariableItem dari panel Variables ke canvas THEN sistem tidak merespons drop event dan variabel tidak ter-insert ke canvas karena `dataTransfer.setData("variable/json", ...)` tidak ditangkap oleh GrapesJS `canvas:dragdata` event listener

1.3 WHEN pengguna membuka modal Manual CSS (CSSEditorModal) dengan node tertentu yang dipilih di canvas THEN sistem menampilkan CSS text kosong atau CSS yang sudah ada tanpa menyediakan template default berupa `#<node_id>{ }` sebagai starting point

1.4 WHEN pengguna menulis CSS property pada Manual CSS editor THEN sistem menerima format penulisan apapun tanpa memvalidasi atau menormalisasi ke format kebab-case standar CSS (contoh: `backgroundColor` diterima tanpa konversi ke `background-color`)

1.5 WHEN pengguna menekan Ctrl+S atau Cmd+S di dalam modal Manual CSS (CSSEditorModal) THEN sistem tidak melakukan aksi save dan shortcut tidak ditangkap oleh modal

1.6 WHEN pengguna menekan Ctrl+S atau Cmd+S di dalam modal Static HTML (StaticHTMLComponent) THEN sistem tidak melakukan aksi save dan shortcut tidak ditangkap oleh modal

### Expected Behavior (Correct)

2.1 WHEN pengguna men-drag block dari Block panel ke canvas THEN sistem SHALL mendeteksi drag event dan meng-insert block component ke posisi drop target pada canvas menggunakan mekanisme drag-and-drop yang kompatibel dengan GrapesJS

2.2 WHEN pengguna men-drag VariableItem dari panel Variables ke canvas THEN sistem SHALL mendeteksi drag event, membaca payload `variable/json` dari dataTransfer, dan meng-insert variable component ke posisi drop target pada canvas melalui `canvas:dragdata` event

2.3 WHEN pengguna membuka modal Manual CSS dengan node tertentu yang dipilih di canvas dan belum ada CSS yang tersimpan untuk node tersebut THEN sistem SHALL menampilkan template default berupa `#<node_id>{ }` (dimana `<node_id>` adalah ID unik dari node/component yang dipilih) sebagai starting point untuk penulisan CSS

2.4 WHEN pengguna menulis CSS property pada Manual CSS editor THEN sistem SHALL memvalidasi dan menormalisasi property name ke format kebab-case standar CSS (contoh: `backgroundColor` dikonversi ke `background-color`, `fontSize` dikonversi ke `font-size`)

2.5 WHEN pengguna menekan Ctrl+S (atau Cmd+S pada macOS) di dalam modal Manual CSS THEN sistem SHALL menjalankan fungsi save yang sama dengan menekan tombol Save/Apply pada modal tersebut

2.6 WHEN pengguna menekan Ctrl+S (atau Cmd+S pada macOS) di dalam modal Static HTML THEN sistem SHALL menjalankan fungsi save yang sama dengan menekan tombol "Simpan HTML" pada modal tersebut

### Unchanged Behavior (Regression Prevention)

3.1 WHEN pengguna mengklik VariableItem pada panel Variables (bukan drag) THEN sistem SHALL CONTINUE TO meng-insert variabel ke komponen yang dipilih di canvas melalui mekanisme click-to-insert yang sudah ada

3.2 WHEN pengguna menekan Ctrl+S di luar modal (pada editor canvas utama) THEN sistem SHALL CONTINUE TO menjalankan command `core:save-template` untuk menyimpan seluruh template

3.3 WHEN pengguna membuka modal Manual CSS dengan node yang sudah memiliki CSS tersimpan THEN sistem SHALL CONTINUE TO menampilkan CSS yang sudah tersimpan sebelumnya (bukan template default)

3.4 WHEN pengguna menulis CSS dalam format kebab-case yang sudah benar (contoh: `background-color: red;`) THEN sistem SHALL CONTINUE TO menerima dan menerapkan CSS tersebut tanpa modifikasi

3.5 WHEN pengguna menekan tombol Cancel/Close pada modal Manual CSS atau Static HTML THEN sistem SHALL CONTINUE TO membuang perubahan yang belum disimpan tanpa efek samping

3.6 WHEN pengguna men-drag block atau variabel pada mode mobile THEN sistem SHALL CONTINUE TO menampilkan pesan bahwa fitur tersebut hanya tersedia di desktop

3.7 WHEN pengguna menekan "/" di dalam Monaco editor pada modal CSS atau HTML THEN sistem SHALL CONTINUE TO mencegah propagasi event ke GrapesJS command palette

---

## Bug Condition (Formal)

### Bug 1 & 2: Drag and Drop Tidak Berfungsi

```pascal
FUNCTION isBugCondition_DragDrop(X)
  INPUT: X of type DragEvent (dari Block panel atau VariableItem panel ke canvas)
  OUTPUT: boolean

  RETURN X.source IN {BlockPanel, VariableItemPanel} AND X.target = Canvas
END FUNCTION

// Property: Fix Checking - Drag and Drop
FOR ALL X WHERE isBugCondition_DragDrop(X) DO
  result ← handleDrop'(X)
  ASSERT result.componentInserted = true AND result.positionCorrect = true
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_DragDrop(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

### Bug 3: Default CSS Template

```pascal
FUNCTION isBugCondition_CSSDefault(X)
  INPUT: X of type CSSModalOpenEvent
  OUTPUT: boolean

  RETURN X.selectedNode != null AND X.existingCSS = ""
END FUNCTION

// Property: Fix Checking - CSS Default Template
FOR ALL X WHERE isBugCondition_CSSDefault(X) DO
  result ← openCSSModal'(X)
  ASSERT result.initialContent = "#" + X.selectedNode.id + "{ }"
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_CSSDefault(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

### Bug 4: CSS Kebab-Case Format

```pascal
FUNCTION isBugCondition_CSSFormat(X)
  INPUT: X of type CSSPropertyName
  OUTPUT: boolean

  RETURN X.contains(uppercase) OR X.format = camelCase
END FUNCTION

// Property: Fix Checking - CSS Format Normalization
FOR ALL X WHERE isBugCondition_CSSFormat(X) DO
  result ← normalizeCssProperty'(X)
  ASSERT result = toKebabCase(X) AND NOT result.contains(uppercase)
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_CSSFormat(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

### Bug 5 & 6: Ctrl+S Shortcut pada Modal

```pascal
FUNCTION isBugCondition_CtrlS(X)
  INPUT: X of type KeyboardEvent
  OUTPUT: boolean

  RETURN (X.ctrlKey OR X.metaKey) AND X.key = "s" AND X.context IN {CSSEditorModal, StaticHTMLModal}
END FUNCTION

// Property: Fix Checking - Ctrl+S Save
FOR ALL X WHERE isBugCondition_CtrlS(X) DO
  result ← handleKeyDown'(X)
  ASSERT result.saved = true AND result.modalClosed = true AND X.defaultPrevented = true
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_CtrlS(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

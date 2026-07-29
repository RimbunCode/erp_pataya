# Design: fix-email-template-body-mention

## Ringkasan

Dua bug independen pada editor body Email Template (`resources/js/Pages/Core/EmailTemplate/Form.jsx` + `resources/js/Components/TiptapEditor.jsx` + `resources/js/Components/TiptapMentionList.jsx`):

1. **Body hilang setelah submit** — saat body berisi tag `@merge-tag`, setelah form disimpan seluruh isi body kosong.
2. **Dropdown `@` tidak scrollable & tidak searchable/highlight** — daftar variable saat mengetik `@` tidak bisa di-scroll kalau panjang, filter berdasarkan teks yang diketik tidak konsisten dengan apa yang user lihat, dan tidak ada highlight match seperti komponen referensi `LinkModel`.

Spec ini **design-first**: root cause bug #1 punya 2 kandidat penyebab yang sudah dipersempit lewat pembacaan kode, tapi keduanya butuh konfirmasi lewat reproduksi manual di browser sebelum fix final ditulis — karena keduanya berada di lapisan state-management generik (`useDraftForm.js`) yang dipakai SEMUA form di aplikasi, bukan cuma Email Template. Salah diagnosis di sini berisiko regresi ke form lain.

## Konteks Arsitektur Saat Ini

### Alur data body (write path)

```
User ketik '@' di TiptapEditor
  → Tiptap Suggestion plugin panggil mentionSourceForBody(query)  [Form.jsx:50-63]
  → GET emailTemplates.fields (axios)                            [Form.jsx:23-30]
  → hasil difilter berdasarkan col.name (BUKAN label tampilan)   [Form.jsx:54-56]  ⚠ bug #2
  → render TiptapMentionList (dropdown, tanpa scroll/highlight)  [TiptapMentionList.jsx] ⚠ bug #2
  → user pilih 1 item → Tiptap insert Mention node
  → editor onUpdate() → onValueChange(json, html)                [TiptapEditor.jsx:446-449]
  → Form.jsx handleBodyChange → setData({body_json, body_html})  [Form.jsx:65-70]
```

### Alur submit (write → server → reset)

```
FormPage.jsx onSubmit → form.put(route('emailTemplates.update', id))  [FormPage.jsx:780-786]
  → useDraftForm.put() → putForm(url, getOptions(options))             [useDraftForm.js:329-333]
  → EmailTemplateController::update()                                  [EmailTemplateController.php:87-99]
      - validasi EmailTemplateRequest (body_html required|string, body_json nullable|array)
      - $emailTemplate->fillForUpdate($data)
      - redirect()->back()
  → Inertia terima response, jalankan onSuccess:                       [useDraftForm.js:261-272]
      - form.setDefaults(e.props[name])   // update form.defaults dari props terbaru
      - setIsDirty(false)
  → recentlySuccessful berubah true → useEffect terpisah                [useDraftForm.js:188-198]
      - form.reset(...Object.keys(initialData ?? {}))
  → FormPage defaultData dihitung ulang dari usePage().props[name]      [FormPage.jsx:712]
  → Form.jsx re-render dengan data.body_json baru
  → TiptapEditor sync effect: value berubah → editor.commands.setContent(value)  [TiptapEditor.jsx:478-486]
```

### Referensi pola yang benar (LinkModel)

`resources/js/Components/LinkModel.jsx` + `resources/js/lib/linkModelUtils.js::convertTemplateLink()`:
- List container: `CommandList` (`resources/js/Components/ui/command.jsx:76-82`) — `max-h-[300px] overflow-y-auto overflow-x-hidden`.
- Filter: `filteredOptions` (LinkModel.jsx:609-633) — cocokkan `convertTemplateLink(opt, "", true).toLowerCase().includes(keyword)` terhadap **teks yang ditampilkan**, bukan field mentah.
- Highlight: escape tiap kata search → build regex gabungan `(kata1|kata2)` case-insensitive → replace hanya node teks (skip tag HTML) dengan `<mark class="bg-yellow-500">$1</mark>` → render via `dangerouslySetInnerHTML`.

## Bug #1 — Body hilang setelah submit

### ROOT CAUSE TERKONFIRMASI (via reproduksi browser nyata)

Direproduksi langsung: buat Email Template baru dengan body berisi 2 tag mention (`{{ $doc->code }}` dan `{{ $doc->files }}`) dipisah teks biasa, submit (create), lalu buka lagi record itu (fresh page load, bukan client-side Inertia nav). Body tampil **KOSONG** di editor meski server mengembalikan data benar.

Bukti konklusif (diambil dari `data-page` attribute Inertia — payload props asli dari server, tanpa distorsi client state):
```json
// props.emailTemplate.body_html (BENAR, lengkap)
"<p>Halo Pelanggan, order Anda dengan nomor<span data-type=\"mention\" data-merge-tag=\"doc.code\">{{ $doc->code }}</span>sudah kami proses. Terima kasih. Salam, <span data-type=\"mention\" data-merge-tag=\"doc.files\">{{ $doc->files }}</span> </p>"

// props.emailTemplate.body_json (mengandung node CACAT)
{
  "type": "doc",
  "content": [{
    "type": "paragraph",
    "content": [
      { "type": "text", "text": "Halo Pelanggan, order Anda dengan nomor" },
      { "type": "mention", "attrs": { "id": "doc.code", "label": "Kode", ... } },
      { "type": "text", "text": "sudah kami proses. Terima kasih. Salam," },
      { "type": "mention", "attrs": { "id": "doc.files", "label": "core.form.files", ... } },
      { "type": "text", "text": null }   // ⚠️ INVALID — ProseMirror text node WAJIB string, bukan null
    ]
  }]
}
```

**Kesimpulan**: `editor.getJSON()` (dipanggil di `onUpdate`, `TiptapEditor.jsx:448`) menghasilkan node `{"type":"text","text":null}` di akhir dokumen — kemungkinan besar sisa text-node placeholder kosong yang terbentuk saat mention node disisipkan tepat di posisi akhir dokumen (tanpa karakter apapun setelahnya). Node ini **valid untuk di-serialize ke JSON** (tak ada validasi saat `getJSON()`), TERSIMPAN ke `body_json` di database apa adanya, TAPI **invalid untuk di-deserialize** — ProseMirror schema mewajibkan node bertipe `text` punya field `text` berupa string non-null. Saat halaman dibuka kembali dan `TiptapEditor` mencoba `content: value` (init, `TiptapEditor.jsx:439`) atau `editor.commands.setContent(value)` (sync effect, baris 484), ProseMirror **throw** saat parsing node cacat ini — exception ini tidak ditangkap (tidak ada try/catch), sehingga:
- Saat **init** (`useEditor({content: value})`): Tiptap kemungkinan fallback ke dokumen kosong secara diam-diam saat parsing gagal (perilaku umum `content` invalid di Tiptap — tidak melempar ke level React, tapi hasil akhirnya dokumen kosong).
- Saat **sync effect** (`setContent`): sesuai kandidat B di bawah, `isUpdatingRef.current` bisa nyangkut `true` jika `setContent` throw sebelum baris `= false` tereksekusi (relevan untuk re-render berikutnya, bukan initial load).

Bug ini TIDAK terkait `useDraftForm.js` (Kandidat A di bawah tidak terkonfirmasi — response Inertia post-submit maupun fresh page load sama-sama membawa `body_html` yang benar; masalahnya murni di sisi `TiptapEditor` gagal me-render `body_json` yang sudah cacat sejak awal disimpan).

### Kandidat root cause A: `useDraftForm` reset menimpa body dengan data stale (TIDAK TERKONFIRMASI — didokumentasikan untuk referensi, lihat kesimpulan di atas)

`useDraftForm.js:188-198`:
```js
useEffect(() => {
  if (!form.recentlySuccessful) return;
  if (isCreate) {
    form.reset();
  } else {
    form.reset(...Object.keys(initialData ?? {}));
  }
}, [form.recentlySuccessful]);
```

`initialData` adalah parameter `defaultData` dari `FormPage.jsx:712` (`usePage().props[name] ?? defaultValues ?? {}`), dihitung ulang setiap render dari props Inertia terkini — bukan snapshot statis. `form.reset(field)` Inertia mengembalikan `form.data[field]` ke `form.defaults[field]`. Alur yang diharapkan:

1. `onSuccess` (`useDraftForm.js:264`) → `form.setDefaults(e.props[name])` — set `form.defaults` = payload props terbaru dari server.
2. Effect reset (baris 188-198) jalan setelahnya (React menjamin urutan commit sebelum effect) → `form.reset(...)` pakai `form.defaults` yang **sudah** ter-update.

Kalau urutan ini benar, `data.body_json` semestinya jadi versi tersimpan di server — bukan kosong. **Kandidat A hanya valid sebagai root cause jika** `e.props[name]` (props Inertia hasil `redirect()->back()`) ternyata **tidak** membawa `body_json`/`body_html` fresh — misalnya karena Inertia partial-reload tidak meng-eksekusi ulang closure lazy `emailTemplate` di `EmailTemplateController::show()` (baris 76-80) pada request redirect-back tertentu (mis. dari referer non-standar, atau race dengan shared data lain di `HandleInertiaRequests`).

**Verifikasi yang dibutuhkan sebelum fix**: buka DevTools Network saat submit update, inspeksi payload response Inertia (`X-Inertia` JSON), cek apakah `props.emailTemplate.body_json` berisi data yang baru saja diketik atau kosong/lama.

### Kandidat root cause B: `isUpdatingRef` macet true, `onUpdate` berhenti terpanggil

`TiptapEditor.jsx:483-485`:
```js
isUpdatingRef.current = true;
editor.commands.setContent(value ?? "", false);
isUpdatingRef.current = false;
```

Guard ini dipakai `onUpdate` (baris 446-449) untuk mencegah loop (`setContent` dari sync effect memicu `onUpdate` lagi, yang akan `onValueChange` dengan data yang sama). Kalau `editor.commands.setContent()` **throw** (mis. `value` berisi node JSON tidak valid — bisa terjadi kalau schema Mention berubah/pinDefinition mismatch), baris `isUpdatingRef.current = false` tidak pernah dieksekusi → **flag nyangkut `true` selamanya** → semua `onUpdate` berikutnya (termasuk saat user mengetik/menambah tag baru setelah titik ini) di-skip → `onValueChange` tidak pernah dipanggil lagi → `data.body_json`/`data.body_html` di React state membeku di versi SEBELUM perubahan tersebut, padahal tampilan visual editor (DOM ProseMirror) tetap terlihat berubah normal ke mata user (sesuai laporan user: "tag dapat dipasang" — terlihat OK saat mengetik). Saat submit, payload yang terkirim ke server adalah **state React yang sudah basi**, bukan apa yang terlihat di layar.

**Verifikasi yang dibutuhkan sebelum fix**: tambahkan `try/catch` sementara + `console.error` di sekitar `setContent` saat debugging manual, ketik tag `@` beberapa kali berturut-turut lalu cek apakah `isUpdatingRef.current` pernah nyangkut `true` (bisa expose via `window.__debugEditor` sementara, dihapus sebelum PR final).

### Rencana fix (final, berdasarkan root cause terkonfirmasi)

Dua lapis fix — sanitasi di titik simpan (cegah data cacat baru) DAN di titik baca (selamatkan render dari data cacat yang sudah kepalang tersimpan):

**Fix 1 — Sanitasi saat serialize, `TiptapEditor.jsx` `onUpdate` (baris 446-449)**

Sebelum memanggil `onValueChange`, bersihkan node text yang `text` bernilai falsy (`null`/`undefined`) dari JSON hasil `editor.getJSON()` — baik dengan menghapus node tersebut (kalau memang node kosong tak berguna) atau mengganti jadi string kosong `""` lalu drop node kosong (ProseMirror text node valid tapi konvensinya tidak menyimpan text node kosong). Tambahkan fungsi util kecil:
```js
function sanitizeProseMirrorJSON(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node.content)) {
    node.content = node.content
      .map(sanitizeProseMirrorJSON)
      .filter((child) => !(child.type === "text" && !child.text));
  }
  return node;
}
```
Dipanggil di `onUpdate`:
```js
onUpdate({ editor }) {
  if (isUpdatingRef.current) return;
  const json = sanitizeProseMirrorJSON(editor.getJSON());
  onValueChange?.(json, editor.getHTML());
},
```

**Fix 2 — Guard saat deserialize, sync effect & init (baris 439, 478-486)**

Bungkus `editor.commands.setContent()` dengan `try/catch` (bukan cuma `try/finally` untuk `isUpdatingRef` — tapi benar-benar tangkap error parsing supaya tidak silently gagal ke dokumen kosong tanpa jejak):
```js
useEffect(() => {
  if (!editor || editor.isDestroyed) return;
  const currentJson = JSON.stringify(editor.getJSON());
  const incomingJson = JSON.stringify(value ?? {});
  if (currentJson === incomingJson) return;
  isUpdatingRef.current = true;
  try {
    editor.commands.setContent(sanitizeProseMirrorJSON(value) ?? "", false);
  } catch (e) {
    console.error("TiptapEditor: gagal memuat content, kemungkinan data lama tidak valid", e);
  } finally {
    isUpdatingRef.current = false;
  }
}, [value, editor]);
```
Sanitasi juga diterapkan ke `value` yang masuk (bukan cuma output `getJSON()`) — supaya **data lama yang sudah kepalang tersimpan cacat di database** (seperti record hasil reproduksi bug ini) tetap bisa direnderkan (best-effort, node cacat di-drop, sisanya tetap tampil), bukan bikin seluruh dokumen kosong.

**Fix 3 — Migrasi data lama (opsional, tergantung berapa banyak record produksi yang sudah terkontaminasi)**

Karena bug ini kemungkinan sudah menghasilkan beberapa `body_json` cacat tersimpan sebelum fix dipasang, task implementasi perlu mengecek: `EmailTemplate::whereNotNull('body_json')->get()` lalu scan `body_json` untuk node `text: null`, dan bersihkan dengan sanitasi yang sama (bisa lewat Tinker manual per kasus, TIDAK perlu migration/command permanen — one-off cleanup, sesuai scope bugfix, bukan fitur baru).

### Test yang dibutuhkan

- Test backend (`EmailTemplateCrudTest.php` atau file baru): submit `body_json` yang SENGAJA mengandung node `{"type":"text","text":null}` (mensimulasikan payload cacat dari client lama), assert tidak ada exception 500, assert data tersimpan (backend tidak perlu tahu soal sanitasi — itu tanggung jawab frontend, tapi backend harus tetap terima payload apa adanya karena `body_json` cuma `nullable|array`, tidak divalidasi strukturnya).
- Verifikasi manual browser (wajib — bagian render React tidak bisa digantikan test otomatis): buat Email Template baru dengan body diakhiri tag mention (skenario yang memicu bug), submit, buka lagi (hard reload/navigasi baru, BUKAN cuma cek state setelah klik submit) — body harus tetap tampil utuh. Ini kunci: reproduksi bug HANYA terlihat setelah reload/buka-ulang, tidak langsung setelah submit.

## Bug #2 — Dropdown `@` tidak scrollable, tidak searchable, tidak ada highlight

### Fix 1 — Scrollable

`TiptapMentionList.jsx`, root `<div>` saat ini:
```jsx
<div className="bg-popover border border-border rounded-md shadow-md overflow-hidden min-w-[160px] py-1">
```
Ganti mengikuti pola `CommandList` (`ui/command.jsx:76-82`): tambahkan `max-h-[300px] overflow-y-auto` pada container list item (pisahkan dari wrapper luar yang tetap pakai `rounded-md overflow-hidden` untuk border-radius, list dalam pakai `overflow-y-auto max-h-[300px]`).

### Fix 2 — Filter konsisten dengan label yang ditampilkan

`Form.jsx:50-63`, filter saat ini:
```js
.filter((col) =>
  query ? col.name.toLowerCase().includes(query.toLowerCase()) : true,
)
```
Masalah: `col.name` adalah nama kolom mentah (mis. `customer_name`), sedangkan yang ditampilkan ke user adalah `label = col.titleTrans ? t(col.titleTrans) : col.name` (bisa berupa "Nama Pelanggan"). User mengetik berdasarkan apa yang dia lihat (label), bukan nama kolom internal.

Fix: hitung `label` dulu, baru filter terhadap `label` (dan tetap sertakan `col.name` sebagai fallback match untuk power-user yang tahu nama kolom):
```js
const mentionSourceForBody = useMemo(
  () => (query) =>
    fetchFieldColumns().then((columns) =>
      columns
        .map((col) => ({
          id: `doc.${col.name}`,
          label: col.titleTrans ? t(col.titleTrans) : col.name,
          name: col.name,
        }))
        .filter((item) =>
          query
            ? item.label.toLowerCase().includes(query.toLowerCase()) ||
              item.name.toLowerCase().includes(query.toLowerCase())
            : true,
        ),
    ),
  [fetchFieldColumns, t],
);
```

### Fix 3 — Highlight match (pola `convertTemplateLink`)

`TiptapMentionList.jsx` perlu:
1. Menerima `query` dari Tiptap suggestion props (saat ini komponen hanya destructure `{ items, command }`/ref — `query` belum diteruskan/dipakai sama sekali). Tiptap `SuggestionProps` menyediakan `query` secara otomatis di object props yang dikirim ke komponen render — tinggal destructure.
2. Highlight sederhana (tidak perlu selengkap `convertTemplateLink` yang menangani HTML embedded, karena `item.label` di sini selalu plain text, bukan HTML) — cukup fungsi kecil lokal:
   ```js
   function highlightMatch(text, query) {
     if (!query) return text;
     const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
     const parts = text.split(new RegExp(`(${escaped})`, "gi"));
     return parts.map((part, i) =>
       part.toLowerCase() === query.toLowerCase() ? (
         <mark key={i} className="bg-yellow-500">{part}</mark>
       ) : (
         part
       ),
     );
   }
   ```
   Dipakai sebagai children React biasa (bukan `dangerouslySetInnerHTML`, karena tidak ada HTML embedded di `label` — lebih aman, hindari XSS surface yang tidak perlu untuk kasus ini).
3. Ganti `<span className="truncate">{item.label}</span>` menjadi `<span className="truncate">{highlightMatch(item.label, query)}</span>`.

### Test yang dibutuhkan

- Tidak ada test JS suite di project ini (dikonfirmasi dari spec `email-features-fixes` notes) — verifikasi murni manual browser: ketik `@`, cek daftar panjang bisa di-scroll; ketik `@na` (atau kata parsial label lain), cek hasil filter cocok dengan label yang terlihat dan ada highlight kuning pada bagian yang cocok.

## File yang Terlibat

| File | Perubahan |
|---|---|
| `resources/js/Components/TiptapEditor.jsx` | Fix kandidat B: `try/finally` di sync effect |
| `resources/js/Hooks/useDraftForm.js` | Fix kandidat A (jika terkonfirmasi): urutan reset vs setDefaults |
| `resources/js/Components/TiptapMentionList.jsx` | Scroll (fix 1), highlight (fix 3), terima `query` |
| `resources/js/Pages/Core/EmailTemplate/Form.jsx` | Filter berdasarkan label (fix 2) |
| `tests/Feature/Core/EmailTemplateCrudTest.php` (atau file baru) | Test round-trip body dengan mention tidak hilang |

## Testing Strategy

1. `php artisan test --compact --filter=EmailTemplate` — semua test existing tetap pass, tambah 1 test baru untuk round-trip body+mention.
2. Manual browser (`npm run dev` aktif): reproduksi bug #1 dulu (sebelum fix) untuk konfirmasi kandidat A vs B, baru terapkan fix yang sesuai. Lalu reproduksi ulang setelah fix untuk pastikan tidak hilang lagi.
3. Manual browser bug #2: scroll dropdown panjang, ketik partial query, cek highlight.
4. `vendor/bin/pint --dirty --format agent` setelah semua task selesai (PHP saja, kalau ada perubahan PHP).
5. `npx eslint --fix` pada file JS yang diubah.

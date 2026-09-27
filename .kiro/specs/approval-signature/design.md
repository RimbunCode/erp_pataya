# Design: Approval Signature

## 1. Arsitektur Umum

Tiga jalur yang bertemu di satu kolom database:

```
 JALUR SIMPAN                       JALUR PAKAI
 ────────────                       ───────────

 Upload gambar ─┐
                ├─→ SignatureImageService ─→ File (PNG) ─→ users.signature_file_id
 Canvas draw ───┘        (GD)                                        │
                                                                     │
                              step APPROVED dengan sequence terbesar │
                                        └─ acted_by_id ──────────────┘
                                                     │
                                                     ▼
                                          {{approvalSignature}}
                                              │           │
                                  initHandlebar.js   PrintTemplateRenderService
                                    (preview FE)        (PDF server)
```

Titik penting: **kedua jalur simpan bertemu di satu service**, dan **kedua jalur pakai membaca satu sumber yang sama**. Percabangan hanya di ujung, bukan di tengah.

## 2. Perubahan Database

### Migration: `add_signature_to_users_table`

```php
Schema::table('users', function (Blueprint $table) {
    $table->foreignUlid('signature_file_id')
        ->nullable()
        ->after('image')
        ->constrained('files')
        ->nullOnDelete();
});
```

**Keputusan: kolom FK, bukan polymorphic `Fileable`.**

Relasi TTD ke user bersifat **satu-ke-satu dan wajib tunggal** (FR1). `Fileable` adalah pivot many-to-many yang tidak memberi jaminan itu; mencegah TTD ganda lewat pivot butuh unique constraint parsial yang lebih rumit daripada satu kolom FK. Lagi pula ini mengikuti persis pola kolom `image` yang sudah ada di tabel yang sama, jadi konsisten dengan codebase.

`nullOnDelete()` dipilih agar penghapusan record `File` tidak menggagalkan query user; kolom cukup menjadi null dan fallback FR9 mengambil alih.

### Model `User`

```php
protected $hidden = [
    'password',
    'remember_token',
    'signature_file_id',   // NFR3: tidak bocor di response API umum
];

public function signatureFile() {
    return $this->belongsTo(File::class, 'signature_file_id');
}

public function hasSignature(): bool {
    return $this->signature_file_id !== null;
}
```

`signature_file_id` masuk `$hidden` supaya tidak ikut ter-serialize pada endpoint daftar user (`UserController::index()` mengembalikan `$users->get()` mentah sebagai JSON). Yang disembunyikan hanya ID berkasnya; keberadaan TTD tetap dapat diketahui lewat `hasSignature()` bila memang dibutuhkan halaman tertentu.

Tambahan pada `$configColumns`:

```php
'signature_file_id' => [
    'ignore' => true,
],
```

Tanpa ini kolom akan muncul di DataTable manage-users sebagai kolom mentah.

## 3. Pemrosesan Gambar

### `app/Services/User/Signature/SignatureImageService.php`

Penempatan mengikuti aturan `{Domain}/{Feature}` pada CLAUDE.md. Domain `User`, feature `Signature` di-nest sejak awal karena diprediksi tumbuh: service ini akan didampingi `SignatureThresholdCalculator` (lihat di bawah), dan berpotensi `SignatureValidator` terpisah.

**Kontrak (NFR4):**

```php
/**
 * Ubah byte gambar apa pun menjadi PNG transparan berisi tanda tangan saja.
 *
 * @param  string  $imageBytes  Byte mentah berkas gambar.
 * @return string  Byte PNG hasil proses.
 *
 * @throws SignatureProcessingException Bila gambar tidak dapat dibaca,
 *                                      kosong, atau terlalu gelap.
 */
public function process(string $imageBytes): string
```

Menerima dan mengembalikan **byte string**, bukan `UploadedFile` atau path. Konsekuensinya service dapat diuji dengan fixture gambar di memori, tanpa `Storage::fake()`, tanpa HTTP request, tanpa database.

### Pipeline internal

```php
public function process(string $imageBytes): string {
    $image = $this->decode($imageBytes);          // 1
    $image = $this->downscaleIfOversized($image); // 2

    if (! $this->hasAlphaChannel($image)) {       // 3
        $image = $this->removeBackground($image); // 4
    }

    $this->assertMeaningful($image);              // 5  (SEBELUM trim)
    $image = $this->trim($image);                 // 6
    $image = $this->normalizeHeight($image);      // 7

    return $this->encodePng($image);              // 8
}
```

#### Langkah 1 — Decode

`imagecreatefromstring()` mendeteksi format sendiri dari magic bytes, sehingga JPEG/PNG/WebP/GIF/BMP tertangani satu baris. Ia mengembalikan `false` untuk masukan yang bukan gambar, dan itulah validasi berbasis-isi yang diminta FR2, bukan pemeriksaan ekstensi.

#### Langkah 2 — Downscale

Gambar melebihi 4000 px pada salah satu sisi diperkecil proporsional dengan `imagescale()` sebelum diproses. Ini yang membuat NFR2 tercapai: biaya threshold berbanding lurus dengan jumlah piksel, jadi membatasi piksel di depan lebih efektif daripada mengoptimalkan loop-nya.

#### Langkah 3 — Deteksi alpha

```php
protected function hasAlphaChannel($image): bool {
    if (! imageistruecolor($image)) {
        return imagecolortransparent($image) >= 0;
    }

    // Sampling, bukan pemindaian penuh: satu piksel semi-transparan saja
    // sudah cukup membuktikan gambar punya alpha bermakna, dan memindai
    // seluruh piksel hanya untuk pertanyaan ya/tidak ini memboroskan
    // waktu yang sama besarnya dengan threshold itu sendiri.
    $w = imagesx($image);
    $h = imagesy($image);
    $step = max(1, (int) (min($w, $h) / 50));

    for ($y = 0; $y < $h; $y += $step) {
        for ($x = 0; $x < $w; $x += $step) {
            if (((imagecolorat($image, $x, $y) >> 24) & 0x7F) > 0) {
                return true;
            }
        }
    }

    return false;
}
```

Gambar yang sudah transparan **melewati** threshold (FR4). Menerapkan threshold padanya akan membaca area transparan sebagai hitam pekat dan menghasilkan blok tinta di mana-mana.

#### Langkah 4 — Adaptive threshold

Dipisah ke kelas sendiri, `SignatureThresholdCalculator`, karena ia murni aritmetika pada array dan layak diuji terpisah dari manipulasi GD.

```php
final class SignatureThresholdCalculator {
    private const BLOCK_SIZE = 32;

    /**
     * Hitung peta ambang per blok dari peta kecerahan.
     *
     * @param  array<int, array<int, int>>  $luminance  [y][x] => 0..255
     * @return array<int, array<int, float>> [blockY][blockX] => ambang
     */
    public function buildThresholdMap(array $luminance, int $width, int $height): array;

    /**
     * Ambang untuk satu piksel, hasil interpolasi bilinear antar blok.
     */
    public function thresholdAt(array $map, int $x, int $y): float;
}
```

**Ambang per blok** memakai *mean minus k-sigma*:

```
threshold_blok = mean − 0.6 × stddev
```

Alasan memilih ini di atas Otsu: blok 32 × 32 yang seluruhnya kertas kosong tidak punya dua puncak histogram, dan Otsu pada kondisi itu akan memaksa membelah noise menjadi "tinta" dan "kertas", memunculkan bintik palsu. Mean-minus-sigma menghasilkan ambang jauh di bawah seluruh piksel blok tersebut, sehingga blok kosong tetap kosong. Angka 0.6 dipilih sebagai titik tengah yang lazim untuk metode Sauvola/Niblack pada dokumen; nilainya dijadikan konstanta agar dapat disetel bila hasil lapangan menuntut.

**Interpolasi bilinear** menjawab masalah nyata: ambang per blok yang diterapkan apa adanya membuat batas antar blok terlihat sebagai kotak-kotak pada hasil, karena dua piksel bersebelahan di tepi blok dapat memakai ambang yang berbeda jauh. Interpolasi membuat ambang berubah mulus melintasi gambar.

**Alpha bergradasi** pada piksel tinta:

```php
$alpha = (int) round(127 * min(1.0, $lum / $threshold));
```

Piksel jauh lebih gelap dari ambang menjadi opak penuh; piksel tepat di batas menjadi hampir transparan. Ini yang menghilangkan tepi bergerigi tanpa perlu anti-aliasing terpisah.

#### Batasan performa yang wajib dipatuhi

Loop piksel di langkah ini adalah bagian terpanas seluruh fitur. Tiga hal berikut menentukan apakah NFR2 tercapai atau meleset sepuluh kali lipat.

**Jangan panggil `imagecolorallocatealpha()` di dalam loop.** Pada citra truecolor, warna ber-alpha adalah bilangan bulat biasa dan dapat disusun langsung:

```php
$color = ($alpha << 24) | ($r << 16) | ($g << 8) | $b;
imagesetpixel($output, $x, $y, $color);
```

`imagecolorallocatealpha()` menjalankan pencarian internal setiap kali dipanggil. Pada 16 juta piksel biayanya mendominasi segalanya, dan inilah penyebab tunggal terbesar bila pipeline berjalan dalam hitungan menit alih-alih detik.

**Jangan menyimpan peta kecerahan sebagai array PHP dua dimensi.** `$luminance[$y][$x]` untuk citra 4000 × 4000 berarti 16 juta zval; konsumsi memorinya ratusan megabyte dan setiap akses melewati hashtable. Gunakan `SplFixedArray` berindeks datar (`$y * $width + $x`), atau hitung ulang kecerahan di loop kedua. Peta **ambang** tetap array biasa karena ukurannya hanya sebanyak blok, yaitu sekitar 125 × 125 untuk citra terbesar.

**Hitung ambang per baris, bukan per piksel.** `thresholdAt()` melakukan interpolasi bilinear yang melibatkan beberapa perkalian. Dipanggil 16 juta kali, biayanya nyata. Karena ambang berubah mulus, cukup hitung ulang saat melintasi batas blok dan interpolasi ringan di antaranya.

Bila setelah ketiganya waktu masih melewati 3 detik, turunkan `MAX_INPUT_DIMENSION` dan catat alasannya; **jangan** melonggarkan NFR2 diam-diam.

#### Langkah 5 — Validasi hasil

```php
$opaqueRatio = $opaquePixels / ($width * $height);

if ($opaquePixels === 0) {
    throw SignatureProcessingException::noSignatureDetected();
}

if ($opaqueRatio > 0.9) {
    throw SignatureProcessingException::imageTooDark();
}
```

Rasio dihitung pada **frame penuh, sebelum trim**. Urutan ini penting dan mudah dibalik.

Bounding box hasil trim menurut definisinya rapat terhadap goresan: tidak ada baris atau kolom terluar yang sepenuhnya kosong, karena itulah yang baru saja dibuang. TTD bergaris tebal, atau gambar uji sederhana berupa garis lurus, wajar mengisi jauh di atas 90% kotaknya sendiri. Mengukur di sana membuat pemeriksaan ini menolak gambar yang justru paling bersih.

Yang hendak ditangkap adalah foto gelap dan gambar terbalik (tinta dan kertas tertukar), dan ciri keduanya adalah tinta memenuhi **seluruh frame asli**. Rasio pada frame penuh mengukur persis itu.

Pemeriksaan `noSignatureDetected` tidak terpengaruh urutan, karena tidak adanya piksel tinta tidak berubah oleh trim. Ia diletakkan di sini agar kedua pemeriksaan tetap berdampingan.

#### Langkah 6 — Trim

Pindai baris dari atas dan bawah, kolom dari kiri dan kanan, berhenti pada garis pertama yang memuat piksel dengan alpha di bawah 127. Crop ke bounding box hasilnya.

Karena langkah 5 sudah memastikan ada piksel tinta, trim di sini selalu menemukan bounding box yang sah dan tidak perlu menangani kasus gambar kosong.

#### Langkah 7 — Normalisasi tinggi

Perkecil ke tinggi maksimum 200 px. Tidak pernah memperbesar: memperbesar TTD kecil hanya menghasilkan gambar buram tanpa menambah informasi.

#### Langkah 8 — Encode

`imagesavealpha($image, true)` wajib dipanggil sebelum `imagepng()`, kalau tidak alpha channel dibuang diam-diam dan seluruh pekerjaan sebelumnya sia-sia. Ini kesalahan GD yang paling sering terjadi dan tidak memunculkan error apa pun.

### `SignatureProcessingException`

`app/Exceptions/User/SignatureProcessingException.php`, dengan named constructor per kasus (`unreadableImage()`, `noSignatureDetected()`, `imageTooDark()`, `unsupportedFormat()`). Tiap kasus memetakan ke kunci terjemahan sendiri, sehingga pesan ke user spesifik, bukan "gagal memproses gambar" yang tidak memberi tahu apa yang harus diperbaiki.

## 4. Endpoint

### Route

```php
Route::post('/users/{user}/signature', [UserController::class, 'signature'])
    ->name('users.signature');
Route::delete('/users/{user}/signature', [UserController::class, 'removeSignature'])
    ->name('users.removeSignature');
Route::get('/users/{user}/signature', [UserController::class, 'showSignature'])
    ->name('users.showSignature');
```

Ditempatkan bersebelahan dengan `users.image` yang sudah ada di `routes/web.php:271-272`.

### Otorisasi — beda dari `image`

Ini bagian yang **tidak boleh** meniru `image` mentah-mentah.

`UserController::exceptPermission()` saat ini memberi jalan pintas untuk pemilik akun, lalu `enforcePermission()` mensyaratkan `write` untuk `image`/`removeImage`. Efeknya, siapa pun dengan permission `write` pada `User` dapat mengganti foto profil orang lain. Untuk foto profil itu dapat diterima; untuk tanda tangan **tidak**, karena berarti seseorang dapat memasang gambar TTD atas nama orang lain dan gambar itu akan ikut tercetak di dokumen resmi.

```php
protected function exceptPermission(string $method) {
    $route   = Route::getCurrentRoute();
    $user_id = $route->originalParameter('user');

    // Mutasi TTD dikunci ke pemilik akun. Sengaja TIDAK mengikuti pola
    // `image`, yang membolehkan pemegang permission write mengubah milik
    // user lain: tanda tangan ikut tercetak di dokumen resmi, sehingga
    // memasangnya atas nama orang lain harus mustahil lewat jalur apa pun.
    if (\in_array($method, ['signature', 'removeSignature'])) {
        return $user_id === Auth::id();
    }

    // ... cabang existing tidak berubah
}
```

Dan `enforcePermission()` **tidak** diberi entri untuk `signature`. Bila `exceptPermission()` mengembalikan false, permintaan jatuh ke pemeriksaan permission normal, dan tidak ada permission yang memberi hak mengubah TTD orang lain.

### `showSignature` — penyajian berkas

```php
public function showSignature(Request $request, User $user) {
    $file = $user->signatureFile;
    abort_if($file === null, 404);
    abort_unless($this->canViewSignatureOf($request->user(), $user), 403);

    return Storage::response($file->path, 'signature.png', [
        'Content-Type'  => 'image/png',
        'Cache-Control' => 'private, max-age=300',
    ]);
}
```

Aturan `canViewSignatureOf()` (FR7): boleh bila **(a)** pemilik akun sendiri, atau **(b)** pemohon dan pemilik TTD sama-sama terlibat pada setidaknya satu `ApprovalInstance` — pemilik sebagai `acted_by_id` pada suatu step, pemohon sebagai pihak yang berhak melihat instance itu lewat `canAccessApprovalInstance()` yang sudah ada di `ApprovalInstanceController`.

Logika kelayakan itu dipindahkan ke `app/Services/Core/Approval/ApprovalAccessService.php` supaya dipakai bersama oleh kedua controller, bukan digandakan. Memindahkannya adalah refactor kecil: method privat yang sudah ada dipanggil ulang dari service, perilakunya tidak berubah.

`Cache-Control: private` mencegah proxy bersama menyimpan TTD.

## 5. Helper Handlebars

### Struktur data yang dibaca

```
document
  └─ approvalable            (morphOne ApprovalInstance, dari trait Submitable)
       └─ steps              (hasMany ApprovalInstanceStep)
            └─ actedBy       (belongsTo User, sudah di $with ApprovalInstanceStep)
                 └─ signatureFile
```

`ApprovalInstanceStep::$with = ['approver', 'actedBy', 'approvers']` berarti `actedBy` ikut termuat otomatis. Yang perlu ditambahkan hanya eager-load `signatureFile`.

**Approver yang dipakai adalah `acted_by_id`, bukan `approverable_id`.** Pada step bertipe role, `approverable_id` menunjuk ke Role, dan role tidak punya tanda tangan. Yang menandatangani adalah orang yang tercatat menyelesaikan step.

### Penentuan penandatangan final

```php
protected function resolveFinalStep(Model $document): ?ApprovalInstanceStep {
    $instance = $document->approvalable;

    if ($instance === null) {
        return null;
    }

    // Step APPROVED dengan sequence terbesar -- BUKAN sekadar sequence
    // terbesar dari seluruh step. Keduanya berbeda begitu ada step
    // SKIPPED (auto-approve) atau WAITING (approval belum selesai),
    // dan hanya step yang benar-benar diselesaikan yang punya
    // acted_by_id untuk diambil tanda tangannya.
    return $instance->steps
        ->filter(function ($step) {
            return $step->status?->value === FormStatus::APPROVED->value
                && $step->acted_by_id !== null;
        })
        ->sortByDesc('sequence')
        ->first();
}
```

Penyaringan dilakukan **di memori**, bukan lewat query, karena `steps` sudah termuat oleh eager-load di bagian 8. Menambah query berklausa `orderBy` di sini akan membatalkan manfaat eager-load itu.

Pemeriksaan `acted_by_id !== null` bukan sekadar pertahanan berlebih. Step dapat berstatus `APPROVED` tanpa `acted_by_id` pada data lama yang dibuat sebelum kolom itu diisi konsisten, dan tanpa penyaringan ini resolver akan memilih step yang tidak punya penandatangan lalu jatuh ke fallback, alih-alih memilih step sebelumnya yang sebenarnya bertanda tangan.

**Auto-approve.** `ApprovalInstance::applyAutoApprove()` menyetel `acted_by_id` ke requester pada step yang cocok dan `SKIPPED` pada step-step sebelumnya. Bila step yang cocok adalah yang terakhir, penandatangan final menjadi requester itu sendiri. Ini benar menurut FR8a dan tidak perlu diperlakukan khusus.

### `app/Services/Core/Approval/SignatureResolverService.php`

```php
/**
 * Resolusi tanda tangan penandatangan final sebuah dokumen.
 *
 * @return array{
 *     image: string|null,   Data URI PNG, null bila penandatangan tak punya TTD
 *     name: string|null,
 *     date: string|null,
 *     hasSignature: bool
 * }|null  null bila dokumen belum punya step approved sama sekali
 */
public function resolveFinalSignature(Model $document): ?array
```

Satu method tanpa parameter step. Service ini juga yang membaca berkas dari storage dan mengubahnya menjadi data URI base64 (FR7), sehingga logika itu tidak tersebar ke helper.

### Helper sisi server

Ditulis mengikuti dua batasan keras yang sudah terdokumentasi panjang di `PrintTemplateRenderService::helpers()`:

1. **Tidak boleh arrow function.** `lightncandy` mengekstrak source closure lewat regex yang mencari kata kunci literal `function`. Arrow function lolos dari regex itu dan membuat source disisipkan apa adanya ke output ter-compile, menghasilkan PHP tidak valid.
2. **Tidak boleh menyebut nama kelas apa pun.** Source closure disalin ke `eval()` di luar namespace kelas ini. Nama pendek gagal resolve, dan FQCN akan dipendekkan lagi oleh Pint sehingga bug-nya kembali. Semua akses harus lewat `$this`.

```php
'approvalSignature' => function ($options) {
    return $this->renderSignatureSlot(
        $options['data']['root']['document'] ?? null,
        (bool) ($options['hash']['showName'] ?? false),
        (bool) ($options['hash']['showDate'] ?? false),
        $options['data']['root']['lang'] ?? 'en',
    );
},
```

Tanpa argumen posisional, `$options` menjadi parameter pertama. Bila template lama sempat ditulis dengan argumen (`{{approvalSignature 2}}`), lightncandy akan meneruskan angka itu sebagai parameter pertama dan `$options` bergeser. Karena itu method penerima memeriksa bentuk argumen yang diterimanya dan mengabaikan nilai posisional apa pun (FR8), alih-alih gagal dengan kesalahan tipe.

Seluruh isinya didelegasikan ke method `renderSignatureSlot()` pada service, yang berada di dalam namespace normal dan bebas dari kedua batasan itu. Closure-nya sendiri sengaja dibuat setipis mungkin justru karena source-nya akan disalin.

`$context['document']` (model asli, bukan array) sudah tersedia di `PrintTemplateRenderService::render()`.

### Helper sisi klien

`initHandlebar.js` mendaftarkan helper bernama sama. Ia tidak dapat membaca storage, jadi ia membaca data yang sudah disiapkan server pada props preview. Untuk template yang dipratinjau dengan data contoh, ia menghasilkan gambar placeholder inline (data URI SVG) agar perancang template melihat tata letaknya (FR8).

**Risiko divergensi.** Dua implementasi helper yang harus berperilaku sama adalah utang yang sudah ada di codebase ini, bukan yang diperkenalkan fitur ini: `relation`, `label`, `trans`, `companyDetail`, `infoColumns` semuanya sudah kembar. Mitigasinya bukan menyatukan keduanya (itu perubahan arsitektur di luar lingkup spec ini), melainkan **satu test yang merender potongan template yang sama lewat kedua jalur dan membandingkan hasilnya**, sehingga divergensi gagal di CI, bukan ditemukan user di PDF produksi.

## 6. Frontend

### `resources/js/Pages/Users/ManageUsers/SignatureField.jsx`

Bagian pada halaman profil, hanya dirender bila `user.id === auth.user.id`.

Isi: pratinjau TTD di atas latar checkerboard, tombol **Unggah**, tombol **Gambar**, tombol **Hapus**.

Checkerboard dibuat dengan CSS gradient, bukan berkas gambar:

```css
background-image:
  linear-gradient(45deg, #ccc 25%, transparent 25%),
  linear-gradient(-45deg, #ccc 25%, transparent 25%),
  linear-gradient(45deg, transparent 75%, #ccc 75%),
  linear-gradient(-45deg, transparent 75%, #ccc 75%);
background-size: 16px 16px;
```

Tanpa latar ini, TTD hitam transparan di atas kartu putih terlihat identik dengan TTD hitam di atas kertas putih, dan user tidak punya cara tahu apakah penghapusan background berhasil.

### `resources/js/Pages/Users/ManageUsers/SignatureCanvas.jsx`

Canvas gambar tangan, tanpa pustaka luar.

- Event pointer (`pointerdown`/`pointermove`/`pointerup`), yang menyatukan mouse, stylus, dan sentuh dalam satu jalur kode.
- `touch-action: none` pada elemen canvas, agar goresan tidak ikut men-scroll halaman di perangkat sentuh.
- Canvas dibuat dengan konteks transparan (tidak diisi putih), sehingga `toBlob()` langsung menghasilkan PNG transparan.
- Ukuran canvas mengikuti `devicePixelRatio` agar goresan tidak buram di layar retina.
- State `hasStroke` mengunci tombol simpan selama canvas kosong (FR3).

Hasil `toBlob()` dikirim ke endpoint yang sama dengan upload, dengan penanda `source=canvas` agar server melewati pipeline threshold.

### Titik pemasangan

`Users/ManageUsers/Show.jsx`, di bawah bagian foto profil yang sudah ada.

## 7. Blok GrapesJS

### `resources/js/lib/gjsSignature.js`

Plugin mengikuti pola `gjsRelationsTable` / `gjsStaticHTML` / `gjsDocHeader` yang sudah terdaftar di `Editor.jsx:681-688`.

```js
export default function gjsSignature(editor) {
  editor.Components.addType("approval-signature", {
    model: {
      defaults: {
        // Tidak ada trait `sequence`: yang tercetak selalu penandatangan
        // final (FR8a), sehingga step tidak dapat dipilih dari template.
        traits: [
          { type: "checkbox", name: "showName", label: "Tampilkan nama" },
          { type: "checkbox", name: "showDate", label: "Tampilkan tanggal" },
        ],
      },
    },
  });

  editor.Blocks.add("approval-signature", {
    label: "Tanda Tangan",
    category: "Approval",
    media: SIGNATURE_ICON_SVG,
    content: { type: "approval-signature" },
  });
}
```

Trait GrapesJS memberi panel properti tanpa perlu UI kustom. Nilai trait diserialisasi menjadi atribut pada markup, lalu diterjemahkan ke pemanggilan `{{approvalSignature}}` oleh `toHTML()` komponen.

Kategori blok diberi nama `Approval` sehingga muncul sebagai kelompok tersendiri di `CustomBlockManager`, yang sudah mengelompokkan blok berdasarkan kategori.

## 8. Integrasi Alur Approval

**Tidak ada perubahan pada `ApprovalInstanceController`, `ApprovalDecided`, maupun `AttachApprovalPdf`.**

TTD ikut ter-render karena `AttachGeneratedPdfJob` memanggil `PrintTemplateRenderService::render()`, dan helper baru bekerja di dalam render itu. Tidak ada hook baru yang perlu dipasang.

Satu penyesuaian di `AttachGeneratedPdfJob::handle()`: eager-load rantai relasi TTD.

```php
$document = $this->approval->document;
$document?->loadMissing('approvalable.steps.actedBy.signatureFile');
```

Job memakai `SerializesModels`, sehingga `$this->approval` di-refetch dari database saat worker menjalankannya. Relasi yang sudah termuat di request tidak ikut terbawa.

Seluruh `steps` dimuat, bukan hanya yang approved, karena penentuan penandatangan final menyaring di memori (bagian 5). Jumlah step per dokumen kecil, jadi memuat semuanya lebih murah daripada query berkondisi terpisah.

## 9. Pertimbangan Renderer PDF

`PdfExportService::isAllowedResourceUrl()` sudah meloloskan `data:` URI secara eksplisit (`str_starts_with(strtolower($url), 'data:')`), sehingga FR12 **tidak memerlukan perubahan** pada sanitizer. Yang dibutuhkan hanya test yang mengunci perilaku itu, agar pengetatan sanitizer di kemudian hari tidak diam-diam mematikan TTD.

Dua jalur renderer diperlakukan berbeda pada pengujian:

- **wkhtmltopdf** menangani PNG transparan tanpa catatan.
- **dompdf** menangani alpha channel, tetapi hanya bila PNG-nya truecolor dengan alpha, bukan palette dengan indeks transparan. Karena `encodePng()` selalu menghasilkan truecolor (`imagecreatetruecolor` + `imagesavealpha`), syarat itu terpenuhi. Test tetap diperlukan untuk memastikan hal ini bertahan.

## 10. Rencana Pengujian

### Unit — `SignatureImageServiceTest`

Fixture gambar dibangkitkan secara programatik di dalam test dengan GD, bukan disimpan sebagai berkas biner di repo. Alasannya: berkas fixture biner tidak dapat di-review pada diff, dan pembangkitnya sendiri mendokumentasikan kondisi apa yang sedang diuji.

| Kasus | Harapan |
| --- | --- |
| TTD hitam di kertas putih | Background transparan penuh |
| Gradien terang-ke-gelap melintasi gambar | Sisi gelap tidak terbaca sebagai tinta |
| Tinta biru | Terdeteksi sebagai tinta |
| PNG yang sudah transparan | Alpha asli dipertahankan, threshold dilewati |
| Kertas polos tanpa goresan | `SignatureProcessingException::noSignatureDetected` |
| Gambar hampir seluruhnya gelap | `SignatureProcessingException::imageTooDark` |
| Goresan tebal memenuhi bounding box-nya sendiri | **Lulus**, bukan `imageTooDark`. Kasus yang mengunci urutan validasi-sebelum-trim |
| JPEG, WebP, GIF, BMP | Semua menghasilkan PNG |
| Byte bukan gambar | `SignatureProcessingException::unreadableImage` |
| Goresan di sudut kanvas lapang | Ter-trim ke bounding box |
| Gambar 50 px | Tidak diperbesar |
| Gambar 4000 × 4000 | Selesai di bawah 3 detik |

### Unit — `SignatureThresholdCalculatorTest`

Menguji aritmetika terpisah dari GD: peta ambang pada masukan seragam, interpolasi yang menghasilkan nilai di antara dua ambang blok, dan perilaku pada tepi gambar tempat blok tetangga tidak lengkap.

### Feature — `UserSignatureTest`

- Pemilik akun dapat mengunggah, mengganti, dan menghapus TTD miliknya.
- User lain **dengan** permission `write` pada `User` tetap **ditolak** (403) saat mencoba mengubah TTD orang lain. Ini pengujian paling penting di berkas ini, karena merupakan titik tempat fitur sengaja menyimpang dari pola `image`.
- Berkas tersimpan dengan `is_public = false` meskipun request menyertakan `isPublic=true`.
- Mengganti TTD menghapus berkas lama dari storage.
- `signature_file_id` tidak muncul pada response daftar user.
- Permintaan berkas TTD tanpa sesi login ditolak.

### Feature — `ApprovalSignatureRenderTest`

Berkas ini menguji FR8a, aturan penandatangan final:

| Skenario | Harapan |
| --- | --- |
| Tiga step approved (Officer, Manager, Finance Manager) | Hanya TTD Finance Manager. TTD dua step lain **tidak** muncul |
| Step terakhir approved, penandatangannya tanpa TTD | Teks nama dan tanggal (FR9) |
| Belum ada step approved sama sekali | Slot kosong |
| Step 3 `WAITING`, step 2 approved | TTD approver step 2, bukan slot kosong |
| Step 1 dan 2 `SKIPPED`, step 3 approved (auto-approve) | TTD requester |
| Step terakhir approved tanpa `acted_by_id` | Jatuh ke step approved sebelumnya yang punya `acted_by_id` |
| Step advanced, satu kandidat menang race | TTD pemenang race, bukan kandidat lain |
| Step bertipe role | TTD user yang approve, bukan mencari TTD pada Role |
| Dokumen tanpa `ApprovalInstance` | Slot kosong, tanpa kesalahan |
| Template dengan dua slot | Tidak ada query tambahan pada slot kedua (dikunci hitungan query) |

Kasus keempat dan keenam adalah yang membedakan implementasi benar dari implementasi `max(sequence)` yang naif; keduanya lolos pada implementasi naif hanya jika seluruh step kebetulan approved.

### Konsistensi helper — `ApprovalSignatureHelperParityTest`

Satu potongan template dirender lewat `PrintTemplateRenderService` dan lewat `initHandlebar.js`, keduanya diberi data yang sama, hasilnya dibandingkan. Ini pengaman terhadap divergensi yang dibahas di bagian 5.

### Frontend

- `SignatureCanvas.rtl.test.jsx` — tombol simpan nonaktif saat kosong, aktif setelah ada goresan, kembali nonaktif setelah dibersihkan.
- `SignatureField.rtl.test.jsx` — pratinjau muncul saat TTD ada, tombol hapus tidak muncul saat tidak ada TTD.

Keduanya memakai suffix `.rtl.test.jsx` sesuai aturan `vitest.config.js`; tanpa suffix itu test jalan di environment `node` dan gagal pada `document is not defined`.

## 11. Ringkasan Berkas Terdampak

### Baru

| Berkas | Isi |
| --- | --- |
| `database/migrations/*_add_signature_to_users_table.php` | Kolom `signature_file_id` |
| `app/Services/User/Signature/SignatureImageService.php` | Pipeline GD |
| `app/Services/User/Signature/SignatureThresholdCalculator.php` | Aritmetika ambang |
| `app/Exceptions/User/SignatureProcessingException.php` | Kesalahan per kasus |
| `app/Services/Core/Approval/SignatureResolverService.php` | Penentuan penandatangan final + resolusi TTD-nya |
| `app/Services/Core/Approval/ApprovalAccessService.php` | Kelayakan akses, dipakai bersama |
| `app/Http/Requests/User/SignatureUploadRequest.php` | Validasi unggahan |
| `resources/js/Pages/Users/ManageUsers/SignatureField.jsx` | Bagian profil |
| `resources/js/Pages/Users/ManageUsers/SignatureCanvas.jsx` | Canvas gambar |
| `resources/js/lib/gjsSignature.js` | Blok GrapesJS |
| `lang/en/user/signature.php`, `lang/id/user/signature.php` | Terjemahan |

### Diubah

| Berkas | Perubahan |
| --- | --- |
| `app/Models/User/User.php` | Relasi, `$hidden`, `$configColumns` |
| `app/Http/Controllers/User/UserController.php` | Tiga action, otorisasi khusus |
| `routes/web.php` | Tiga route |
| `app/Services/Core/PrintTemplate/PrintTemplateRenderService.php` | Helper + method render slot |
| `resources/js/lib/initHandlebar.js` | Helper sisi klien |
| `resources/js/Pages/Core/PrintTemplate/Editor.jsx` | Registrasi plugin |
| `resources/js/Pages/Users/ManageUsers/Show.jsx` | Pasang `SignatureField` |
| `app/Jobs/Core/AttachGeneratedPdfJob.php` | `loadMissing` rantai relasi |
| `app/Http/Controllers/Core/ApprovalInstanceController.php` | Ekstrak kelayakan akses ke service |

Total sekitar 11 berkas baru dan 9 berkas diubah.

# wkhtmltopdf binary

Folder ini tempat binary `wkhtmltopdf` diletakkan di server (tidak di-commit
ke git — ukuran besar dan environment-specific).

## Setup di server (shared hosting, tanpa root)

1. Download static build `generic-linux-amd64` dari rilis resmi
   `wkhtmltopdf/packaging` (versi `0.12.6.1-2` atau lebih baru).
2. Extract, ambil binary `wkhtmltopdf` (tanpa dependency shared library
   tambahan pada static build).
3. Upload ke `<deploy-dir>/shared/storage/app/bin/wkhtmltopdf` di server
   (lihat `.scripts/deploy-production.sh` / `deploy-staging.sh` — seluruh
   `storage/` tiap rilis di-symlink ke `shared/storage/`, jadi binary ini
   **cukup di-upload sekali** dan otomatis persisten lintas deploy, tidak
   perlu diulang tiap release).
4. `chmod +x` pada binary tersebut.
5. Pastikan `WKHTMLTOPDF_BINARY_PATH` di `.env` (yang juga tersimpan di
   `shared/.env`) mengarah ke path ini (atau biarkan kosong — default
   `config/pdf.php` sudah menunjuk ke `storage_path('app/bin/wkhtmltopdf')`,
   yang otomatis resolve ke lokasi shared lewat symlink).

Jika binary tidak ada atau gagal dieksekusi, sistem otomatis fallback ke
dompdf (lihat `App\Services\Core\PrintTemplate\PdfExportService`).

<?php

namespace App\Traits;

/**
 * Kontrak panel relasi pada dokumen (lihat .kiro/specs/document-relation-panels).
 *
 * Default di sini membuat model tanpa deklarasi tidak mendapat tab panel,
 * sehingga halaman dokumennya tidak berubah.
 */
trait HasRelationPanel {
    /**
     * Definisi panel untuk model ini ketika ditampilkan sebagai relasi di dokumen lain.
     *
     * `eager` adalah relasi yang dimuat sekali per tipe lewat whereIn, supaya
     * relationPanelRow() tidak memicu N+1.
     *
     * `aggregate_key` dipakai bila nilai yang dijumlahkan berbeda dari nilai
     * yang ditampilkan, misalnya kolom uang yang menampilkan mata uang
     * transaksi tetapi menjumlahkan mata uang dasar. Baris yang dikembalikan
     * relationPanelRow() harus memuat key itu.
     *
     * @return array{
     *   title?: string,
     *   columns?: array<int, array{key: string, label: string, align: string, format?: string, aggregate?: string, aggregate_key?: string}>,
     *   eager?: array<int, string>
     * }
     */
    public static function relationPanel(): array {
        return [];
    }

    /**
     * Nilai per baris panel. Dipanggil sekali per record relasi.
     *
     * Kunci `id` ditambahkan oleh RelationPanelService untuk tautan baris.
     *
     * @return array<string, mixed>
     */
    public function relationPanelRow(): array {
        return ['code' => $this->code ?? null];
    }

    /**
     * Kolom dan eager untuk rincian per baris (tombol buka). Kosong berarti
     * baris tidak punya tombol buka dan payload tidak memuat key detail.
     *
     * `eager` digabung dengan eager panel, jadi relasi rincian dimuat sekali
     * per tipe dan tidak menambah query per baris.
     *
     * @return array{
     *   columns?: array<int, array{key: string, label: string, align: string, format?: string}>,
     *   eager?: array<int, string>
     * }
     */
    public static function relationPanelDetail(): array {
        return [];
    }

    /**
     * Baris item dokumen ini untuk rincian per baris. Dipanggil sekali per record.
     *
     * @return array<int, array<string, mixed>>
     */
    public function relationPanelDetailRows(): array {
        return [];
    }

    /**
     * Panel yang mungkin ada di dokumen ini, termasuk yang belum terisi.
     *
     * Kunci array adalah nama kelas model tujuan. `action` berisi tombol
     * pembuatan dokumen saat panel kosong, atau null bila tidak ada aksi.
     *
     * `remainder` adalah blok sisa di bawah daftar dokumen. `rows` berisi nama
     * method pada model ini yang mengembalikan barisnya. Blok dilewati bila
     * method itu mengembalikan array kosong.
     *
     * `source` menyebut method pada model ini yang mengembalikan QUERY BUILDER
     * record tujuan. Bila ada, baris diambil dari sana dan ModelConnection tidak
     * dipakai. Penjagaan panel tetap berlaku, karena builder itu lewat jalur yang
     * sama. `title` menimpa judul dari relationPanel() untuk entri ini saja,
     * karena panel retur memakai tipe yang sama dengan dokumennya dan judulnya
     * harus berbeda dari panel penerimaan.
     *
     * @return array<class-string, array{
     *   action: array{route: string, params?: array<string, mixed>, label: string, permission?: string}|null,
     *   remainder?: array{title: string, columns: array<int, array<string, mixed>>, rows: string},
     *   source?: string,
     *   title?: string
     * }>
     */
    public static function expectedRelationPanels(): array {
        return [];
    }
}

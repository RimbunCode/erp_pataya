<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Spec datatable2-group-tree (Requirement 3.6, 18.1): `saved_filters.group`
 * berubah dari SATU objek `{column, granularity, range}` menjadi `Groups`
 * (list level bertingkat). Tipe kolom JSON tidak berubah -- hanya isinya.
 *
 * Pakai query builder (bukan model SavedFilter): accessor `group` model akan
 * menormalkan baris pada saat dibaca, sedangkan migration harus melihat &
 * menulis bentuk mentahnya sendiri.
 */
return new class extends Migration
{
    public function up(): void {
        DB::table('saved_filters')
            ->whereNotNull('group')
            ->select(['id', 'group'])
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    $decoded = \json_decode($row->group, true);

                    // Hanya bentuk lama (objek dengan key `column`); list yang
                    // sudah baru (mis. migration dijalankan ulang) dibiarkan.
                    if (! \is_array($decoded) || ! \array_key_exists('column', $decoded)) {
                        continue;
                    }

                    $column = $decoded['column'];
                    DB::table('saved_filters')->where('id', $row->id)->update([
                        // Objek lama tanpa kolom valid = "tidak mengatur group".
                        'group' => \is_string($column) && \trim($column) !== ''
                            ? \json_encode([$decoded])
                            : null,
                    ]);
                }
            });
    }

    /**
     * LOSSY untuk filter dengan >1 level: hanya level pertama yang kembali
     * jadi objek (bentuk lama cuma bisa menyimpan satu group).
     */
    public function down(): void {
        DB::table('saved_filters')
            ->whereNotNull('group')
            ->select(['id', 'group'])
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    $decoded = \json_decode($row->group, true);

                    if (! \is_array($decoded) || ! \array_is_list($decoded)) {
                        continue;
                    }

                    DB::table('saved_filters')->where('id', $row->id)->update([
                        'group' => $decoded === [] ? null : \json_encode($decoded[0]),
                    ]);
                }
            });
    }
};

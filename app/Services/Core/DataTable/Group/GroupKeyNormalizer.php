<?php

namespace App\Services\Core\DataTable\Group;

/**
 * Nilai SQL mentah sebuah grup -> `key` string ternormalisasi (identitas grup
 * yang dibandingkan FE). Dipindah apa adanya dari blok pembacaan hasil count
 * query di DataTableScope (spec datatable2-group-tree, task 3.1).
 */
class GroupKeyNormalizer {
    /**
     * Key eksplisit 'null' (string) utk grup NULL -- array PHP otomatis cast
     * key null jadi '' ("" != frontend String(null) === 'null'), pluck() polos
     * jadi mismatch dgn lookup FE.
     *
     * Kolom boolean: $rawValue di sini nilai MENTAH dari SQL (stdClass query
     * builder, TIDAK lewat cast Eloquent) -- SQLite/MySQL simpan sbg 0/1,
     * sedangkan row asli (data.data, model ter-hydrate) di-JSON-kan lewat cast
     * 'boolean' jadi true/false literal, dibaca FE via String(rawBoolean) =>
     * "true"/"false". Tanpa normalisasi ini key "0"/"1" tidak pernah match
     * "true"/"false" (ketauan lewat browser).
     *
     * Kolom formStatuses (array status, mis. Submitable::status): MySQL
     * menormalkan output kolom JSON jadi `["a", "b"]` (spasi setelah koma), FE
     * cocokkan key dgn JSON.stringify (`["a","b"]`). Di-encode ulang supaya
     * sama; 2 bentuk teks yg ternormalisasi ke key sama (MariaDB simpan teks
     * verbatim) harus DIJUMLAHKAN oleh pemanggil, bukan saling timpa.
     */
    public static function key(mixed $rawValue, ?string $type): string {
        if ($type === 'boolean' && $rawValue !== null) {
            $rawValue = ((bool) $rawValue) ? 'true' : 'false';
        } elseif ($type === 'formStatuses' && \is_string($rawValue)) {
            $decoded  = \json_decode($rawValue, true);
            $rawValue = \is_array($decoded)
                ? \json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                : $rawValue;
        }

        return (string) ($rawValue ?? 'null');
    }
}

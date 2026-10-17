<?php

namespace App\Services\Core\DataTable\Template;

/**
 * Menyiapkan metadata kolom (`getColumns()`) untuk dikirim ke frontend.
 *
 * Key `expression` (SQL developer) hanya dipakai server dan TIDAK PERNAH dikirim
 * ke frontend -- baik di prop Inertia maupun respons JSON/XHR yang memuat metadata kolom.
 */
final class DataTableColumnPresenter {
    /** Key kolom yang hanya boleh ada di server. */
    private const SERVER_ONLY_KEYS = ['expression'];

    /**
     * @param  array<int|string, mixed>  $columns  list/keyed kolom (boleh bersarang lewat key `columns`)
     * @return array<int|string, mixed>
     */
    public static function forFrontend(array $columns): array {
        foreach ($columns as $index => $column) {
            if (! is_array($column)) {
                continue;
            }
            $columns[$index] = array_diff_key($column, array_flip(self::SERVER_ONLY_KEYS));

            if (isset($columns[$index]['columns']) && is_array($columns[$index]['columns'])) {
                $columns[$index]['columns'] = self::forFrontend($columns[$index]['columns']);
            }
        }

        return $columns;
    }
}

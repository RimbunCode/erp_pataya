<?php

namespace App\Services\Core\DataTable\Group;

use Illuminate\Http\Request;

/**
 * Gerbang level grup untuk endpoint LinkModel (`selectData`/`model`).
 *
 * Level grup dari request (atau default model bila opt-in `groupTree`) HANYA
 * boleh memakai kolom "aman" (`safeLookupColumns`: templateLink, `linkable`,
 * `forceSelect`, lolos `visibleFor`) -- kalau tidak, `GROUP BY` membocorkan nilai
 * distinct kolom terlarang lewat daftar grup. Gate `groupable` tetap dijalankan
 * macro `dataTable()` (GroupColumnGate) setelah ini.
 *
 * Kolom level ditambahkan ke daftar `requested` (diminta eksplisit) sebelum
 * `safe` dihitung: kolom skalar tetap wajib `linkable`/templateLink/`forceSelect`,
 * relasi lolos selama `visibleFor` terpenuhi, dan kolom ANAK relasi tetap
 * disaring aturan kolom aman model relasinya.
 *
 * Spec linkmodel-grouping-search Requirement 3.
 */
class LinkModelGroupGate {
    /**
     * Apakah request menyentuh jalur grup sama sekali.
     */
    public static function isActive(Request $request): bool {
        return $request->boolean('groupTree') || $request->has('group') || $request->has('groupPath');
    }

    /**
     * Level kandidat: `?group=` eksplisit (kosong = "Tidak ada") > default
     * model (hanya bila opt-in `groupTree`) > kosong.
     *
     * @param  class-string  $target
     * @return list<array{column: string, granularity: mixed, range: mixed}>
     */
    public static function candidateLevels(Request $request, string $target): array {
        $wire = GroupLevels::fromWire($request);
        if ($wire !== null) {
            return $wire;
        }

        return $request->boolean('groupTree') && \method_exists($target, 'getDefaultGroups')
            ? GroupLevels::normalize($target::getDefaultGroups())
            : [];
    }

    /**
     * Buang level di luar `safe`, lalu tulis ulang param grup request dgn hasilnya
     * (bentuk kawat) sehingga macro hanya melihat level yang lolos.
     *
     * @param  list<array{column: string, granularity: mixed, range: mixed}>  $levels
     * @param  array<string, bool>  $safe
     * @return list<array{column: string, granularity: mixed, range: mixed}>
     */
    public static function apply(Request $request, array $levels, array $safe): array {
        $kept = \array_values(\array_filter($levels, fn (array $level) => isset($safe[$level['column']])));

        // Bersihkan sisa param granularity/range (bisa milik level yang dibuang)
        // sebelum menulis ulang dari level yang lolos.
        $body = $request->isJson() ? $request->json() : $request->request;
        foreach (['groupGranularity', 'groupRange'] as $param) {
            $body->remove($param);
            $request->query->remove($param);
        }
        $request->merge(GroupLevels::toWire($kept));

        return $kept;
    }
}

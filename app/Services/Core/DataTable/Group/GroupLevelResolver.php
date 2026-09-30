<?php

namespace App\Services\Core\DataTable\Group;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Menentukan `Groups` EFEKTIF sebuah request DataTable: rantai prioritas +
 * gate `groupable` per level (spec datatable2-group-tree, Requirement 4).
 *
 * Prioritas kandidat (tidak berubah semantiknya dari versi 1 kolom):
 *  1. `?group=` (ada; KOSONG = user sengaja "Tidak ada" -> menimpa filter/default)
 *  2. `group` milik filter aktif (saved filter, ?fid= atau default shared filter)
 *  3. default model (Model::getDefaultGroups())
 * (2) & (3) hanya diteruskan pemanggil utk request halaman/Inertia -- konsumen
 * XHR macro (dropdown LinkModel, QuickList dashboard) tak boleh berubah urutan.
 *
 * granularity/range per level: param URL > level pada filter/default (kolom
 * SAMA) > default kolom. `?group=<kolom lain>` TIDAK mewarisi granularity kolom
 * default.
 */
class GroupLevelResolver {
    /**
     * Group efektif utk request ini.
     *
     * @param  array<mixed>  $appliedGroups  `Groups` milik filter aktif (kosong bila bukan request Inertia)
     * @param  array<mixed>  $modelDefaults  `Groups` default model (kosong bila bukan request Inertia)
     * @param  array<mixed>  $dataTableColumns  sudah lewat GroupColumnGate::sanitizeColumns()
     * @return list<ResolvedGroupLevel>
     */
    public static function resolve(
        Request $request,
        array $appliedGroups,
        array $modelDefaults,
        array $dataTableColumns,
        Model $model,
        string $nameOfTable,
    ): array {
        $fallback = self::fallbackGroups($appliedGroups, $modelDefaults);
        $wire     = GroupLevels::fromWire($request);

        if ($wire === null) {
            // Tanpa `?group=`: grup dari filter/default, tapi `?groupGranularity=`
            // / `?groupRange=` eksplisit tetap menimpa (perilaku existing).
            $candidates = GroupLevels::withWireOptions($fallback, $request);
        } else {
            // `?group=` eksplisit: level yang tak menyebut granularity/range
            // mewarisi dari level fallback dgn kolom SAMA.
            $inheritFrom = \array_column($fallback, null, 'column');
            $candidates  = \array_map(function (array $level) use ($inheritFrom) {
                $inherited = $inheritFrom[$level['column']] ?? null;

                $level['granularity'] ??= $inherited['granularity'] ?? null;
                $level['range'] ??= $inherited['range'] ?? null;

                return $level;
            }, $wire);
        }

        return self::gate($candidates, $dataTableColumns, $model, $nameOfTable);
    }

    /**
     * Group EFEKTIF TANPA PARAM (filter aktif ?? default model) yang lolos
     * gate -- dibagikan ke FE sbg `defaultGroups` supaya state awalnya cocok
     * dgn yang dieksekusi backend saat halaman dimuat tanpa param apa pun
     * (Requirement 4.5). Bisa beda dari resolve() bila request mengirim
     * `?group=` eksplisit.
     *
     * @param  array<mixed>  $appliedGroups
     * @param  array<mixed>  $modelDefaults
     * @param  array<mixed>  $dataTableColumns
     * @return list<ResolvedGroupLevel>
     */
    public static function resolveDefaults(
        array $appliedGroups,
        array $modelDefaults,
        array $dataTableColumns,
        Model $model,
        string $nameOfTable,
    ): array {
        return self::gate(
            self::fallbackGroups($appliedGroups, $modelDefaults),
            $dataTableColumns,
            $model,
            $nameOfTable,
        );
    }

    /**
     * Filter aktif yang MENGATUR group menang atas default model; filter tanpa
     * group (null) jatuh ke default model.
     *
     * @return list<array{column: string, granularity: mixed, range: mixed}>
     */
    private static function fallbackGroups(array $appliedGroups, array $modelDefaults): array {
        $applied = GroupLevels::normalize($appliedGroups);

        return $applied !== [] ? $applied : GroupLevels::normalize($modelDefaults);
    }

    /**
     * Gate `groupable` per level: level tak valid dibuang diam-diam (urutan
     * sisanya dipertahankan), lalu dipotong ke MAX_LEVELS.
     *
     * @param  list<array{column: string, granularity: mixed, range: mixed}>  $candidates
     * @param  array<mixed>  $dataTableColumns
     * @return list<ResolvedGroupLevel>
     */
    private static function gate(array $candidates, array $dataTableColumns, Model $model, string $nameOfTable): array {
        $levels = [];
        foreach ($candidates as $candidate) {
            $gate = GroupColumnGate::gate($candidate['column'], $dataTableColumns, $model);
            if (! $gate['isGroupable']) {
                continue;
            }

            /** @var array<string, mixed> $config */
            $config    = $gate['config'];
            $sqlColumn = $gate['sqlColumn'];
            $qualified = \preg_match('/^\w+\.\w+$/', $sqlColumn) ? $sqlColumn : "$nameOfTable.$sqlColumn";
            $type      = $config['type'] ?? null;

            $granularity = GroupBucket::effectiveGranularity($type, $candidate['granularity']);
            $range       = GroupBucket::effectiveRange($type, $config, $candidate['range']);

            $levels[] = new ResolvedGroupLevel(
                column: $candidate['column'],
                type: $type,
                config: $config,
                sqlColumn: $sqlColumn,
                qualified: $qualified,
                granularity: $granularity,
                range: $range,
                bucket: GroupBucket::expression($type, $qualified, $granularity, $range),
            );
        }

        return \array_slice($levels, 0, GroupLevels::MAX_LEVELS);
    }
}

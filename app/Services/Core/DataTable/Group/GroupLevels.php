<?php

namespace App\Services\Core\DataTable\Group;

use Illuminate\Http\Request;

/**
 * Kontrak group multi-level DataTable2 -- satu-satunya bentuk yang beredar di
 * BE (default model, saved filter, Filter Templates, URL). Padanan FE:
 * resources/js/Components/Table/Group/groupLevels.js (Property 6 spec
 * datatable2-group-tree: input sama -> `Groups` sama di PHP & JS).
 *
 *     Groups = list<array{column: string, granularity: mixed, range: mixed}>
 *
 * Urutan = nesting (index 0 = terluar), kolom unik (yang pertama menang).
 *
 * normalize() bersifat STRUKTURAL, bukan sanitasi nilai: ia hanya mengubah
 * berbagai bentuk masukan jadi `Groups`. Nilai `granularity`/`range` yang salah
 * TIDAK dikoreksi dan jumlah level TIDAK dipotong ke MAX_LEVELS -- supaya
 * FormRequest (SavedFilter::groupValidationRules()) tetap bisa menolaknya
 * dengan 422. Koreksi nilai & pemotongan utk jalur URL/default adalah tugas
 * GroupLevelResolver (runtime).
 */
class GroupLevels {
    public const MAX_LEVELS    = 4;
    public const GRANULARITIES = ['day', 'month', 'quarter', 'half', 'year'];

    /**
     * Masukan yang diterima: null/''/[] (-> []), string satu kolom, string CSV
     * "a,b" (khusus URL), objek lama {column, granularity?, range?} (-> 1
     * level), list string, list objek, atau campuran list string/objek.
     *
     * @return list<array{column: string, granularity: mixed, range: mixed}>
     */
    public static function normalize(mixed $input): array {
        if (\is_string($input)) {
            $items = \explode(',', $input);
        } elseif (\is_array($input)) {
            if (\array_key_exists('column', $input)) {
                $items = [$input]; // objek lama {column, ...} -> 1 level
            } elseif (\array_is_list($input)) {
                $items = $input;
            } else {
                return []; // objek asosiatif tanpa `column` -- bukan list, bukan level
            }
        } else {
            return [];
        }

        $levels = [];
        foreach ($items as $item) {
            $level = self::normalizeLevel($item);
            if ($level !== null && ! isset($levels[$level['column']])) {
                $levels[$level['column']] = $level;
            }
        }

        return \array_values($levels);
    }

    /**
     * Baca group dari query string (bentuk kawat): `group=a,b`,
     * `groupGranularity[a]=month`, `groupRange[b]=100`. Skalar lama
     * (`groupGranularity=month`, `groupRange=100`) dianggap milik level pertama.
     *
     * Beda `null` vs `[]` PENTING: `null` = param `group` tidak ada (pemanggil
     * boleh pakai filter aktif/default model), `[]` = `group=` kosong eksplisit
     * ("Tidak ada", menimpa filter/default).
     *
     * @return list<array{column: string, granularity: mixed, range: mixed}>|null
     */
    public static function fromWire(Request $request): ?array {
        if (! $request->has('group')) {
            return null;
        }

        return self::withWireOptions(self::normalize($request->input('group')), $request);
    }

    /**
     * Timpa `granularity`/`range` tiap level dgn nilai dari query string
     * (`groupGranularity[kolom]`/`groupRange[kolom]`, atau skalar lama utk level
     * pertama) -- param URL menang atas nilai yang sudah ada di level. Level
     * tanpa param URL dibiarkan. Dipakai fromWire() DAN utk group efektif dari
     * filter/default model saat request cuma membawa `?groupGranularity=`
     * tanpa `?group=`.
     *
     * @param  list<array{column: string, granularity: mixed, range: mixed}>  $levels
     * @return list<array{column: string, granularity: mixed, range: mixed}>
     */
    public static function withWireOptions(array $levels, Request $request): array {
        $granularity = $request->input('groupGranularity');
        $range       = $request->input('groupRange');

        foreach ($levels as $index => $level) {
            $levels[$index]['granularity'] = self::wireValue($granularity, $level['column'], $index)
                ?? $level['granularity'];
            $levels[$index]['range'] = self::normalizeRange(self::wireValue($range, $level['column'], $index))
                ?? $level['range'];
        }

        return $levels;
    }

    /**
     * Kebalikan fromWire(): `Groups` -> param URL. `Groups` kosong menghasilkan
     * `group=` kosong (eksplisit "Tidak ada").
     *
     * @param  array<mixed>  $groups
     * @return array{group: string, groupGranularity?: array<string, mixed>, groupRange?: array<string, mixed>}
     */
    public static function toWire(array $groups): array {
        $levels = self::normalize($groups);
        $wire   = ['group' => \implode(',', \array_column($levels, 'column'))];

        foreach ($levels as $level) {
            if ($level['granularity'] !== null) {
                $wire['groupGranularity'][$level['column']] = $level['granularity'];
            }
            if ($level['range'] !== null) {
                $wire['groupRange'][$level['column']] = $level['range'];
            }
        }

        return $wire;
    }

    /**
     * @return array{column: string, granularity: mixed, range: mixed}|null
     */
    private static function normalizeLevel(mixed $item): ?array {
        if (\is_string($item)) {
            $column = \trim($item);

            return $column === '' ? null : ['column' => $column, 'granularity' => null, 'range' => null];
        }

        if (\is_array($item) && isset($item['column']) && \is_string($item['column'])) {
            $column = \trim($item['column']);
            if ($column === '') {
                return null;
            }
            $granularity = $item['granularity'] ?? null;

            return [
                'column'      => $column,
                'granularity' => $granularity === '' ? null : $granularity,
                'range'       => self::normalizeRange($item['range'] ?? null),
            ];
        }

        return null;
    }

    /**
     * String numerik dari URL ("100") -> angka; nilai lain apa adanya (nilai
     * salah sengaja TIDAK dikoreksi, lihat catatan kelas).
     */
    private static function normalizeRange(mixed $range): mixed {
        if ($range === '' || $range === null) {
            return null;
        }

        return \is_string($range) && \is_numeric($range) ? $range + 0 : $range;
    }

    /**
     * Ambil nilai per-kolom dari param bentuk peta (`groupGranularity[a]=…`)
     * atau skalar lama (hanya level pertama).
     */
    private static function wireValue(mixed $param, string $column, int $index): mixed {
        if (\is_array($param)) {
            return $param[$column] ?? null;
        }

        return $index === 0 && $param !== '' ? $param : null;
    }
}

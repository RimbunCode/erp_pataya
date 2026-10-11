<?php

namespace App\Services\Core\DataTable\Group;

use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Validasi `groupPath` request expand: JSON array nilai `raw` grup leluhur dari
 * level-0 ke bawah (spec datatable2-group-tree, Requirement 7.3).
 *
 * Ini panggilan API (XHR dari GroupTree), bukan URL yang di-bookmark, jadi
 * input invalid dijawab **422 JSON** -- bukan diam-diam diabaikan spt gate
 * `group` dan bukan 500/SQL error. Nilai yang lolos SELALU di-bind sebagai
 * parameter SQL oleh GroupNodeQuery (tak pernah diinterpolasi).
 */
class GroupPath {
    /**
     * @param  list<ResolvedGroupLevel>  $levels
     * @return list<mixed> path tervalidasi (kosong = level-0)
     *
     * @throws HttpResponseException 422 bila invalid
     */
    public static function parse(mixed $raw, array $levels): array {
        if ($raw === null || $raw === '') {
            return [];
        }

        $path = \is_string($raw) ? \json_decode($raw, true) : $raw;
        if (! \is_array($path) || ! \array_is_list($path)) {
            self::invalid('groupPath harus berupa JSON array.');
        }
        if (\count($path) > \count($levels)) {
            self::invalid('groupPath lebih panjang dari jumlah level grup.');
        }

        foreach ($path as $index => $value) {
            $type = $levels[$index]->type;

            if ($value === null) {
                continue; // grup NULL -- sah utk semua tipe
            }

            if ($type === 'formStatuses') {
                // Daftar varian teks mentah yg menormalisasi ke key yang sama.
                if (! \is_array($value) || ! \array_is_list($value) || \array_filter($value, fn ($v) => ! \is_string($v)) !== []) {
                    self::invalid("groupPath[$index] harus berupa list string untuk kolom formStatuses.");
                }
            } elseif (\in_array($type, ['number', 'currency'], true)) {
                if (! \is_numeric($value)) {
                    self::invalid("groupPath[$index] harus numerik untuk kolom number/currency.");
                }
            } elseif (! \is_scalar($value)) {
                self::invalid("groupPath[$index] harus berupa nilai skalar atau null.");
            }
        }

        return $path;
    }

    private static function invalid(string $message): never {
        throw new HttpResponseException(response()->json([
            'message' => $message,
            'errors'  => ['groupPath' => [$message]],
        ], 422));
    }
}

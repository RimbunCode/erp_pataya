<?php

namespace App\Services\Report;

use Illuminate\Http\Request;

/**
 * Menyimpan filter dasar laporan di session, karena DataTable2 hanya meneruskan
 * parameter yang ia kenal (sort, fid, page, show, group) saat memuat ulang tabel
 * lewat XHR. Tanpa ini, rentang tanggal dan dropdown hilang saat paging.
 *
 * Aturan: bila request memuat salah satu kunci filter di query string, nilai
 * request dipakai dan disimpan (kunci yang tidak dikirim dianggap kosong). Bila
 * tidak ada sama sekali, nilai terakhir dari session yang dipakai.
 */
final class ReportFilterStore {
    private const SESSION_PREFIX = 'report_filters.';

    /**
     * @param  list<string>  $keys  kunci filter dasar laporan (nama parameter query)
     * @return array<string, string|null>
     */
    public function resolve(Request $request, string $report, array $keys): array {
        $sessionKey = self::SESSION_PREFIX . $report;
        $query      = $request->query();

        $isExplicit = false;
        foreach ($keys as $key) {
            if (\array_key_exists($key, $query)) {
                $isExplicit = true;
                break;
            }
        }

        if ($isExplicit) {
            $values = [];
            foreach ($keys as $key) {
                $values[$key] = $request->filled($key) ? (string) $request->query($key) : null;
            }
            $request->session()->put($sessionKey, $values);

            return $values;
        }

        $stored = $request->session()->get($sessionKey, []);

        $values = [];
        foreach ($keys as $key) {
            $values[$key] = $stored[$key] ?? null;
        }

        return $values;
    }
}

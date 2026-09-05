<?php

namespace App\Services\Core;

use App\Models\Core\Chart;
use App\Models\Core\NumberCard;

/**
 * Requirement H (optimasi dashboard): warming cache PROAKTIF utk Number Card/
 * Chart yang benar-benar terpasang di Desk (via `dashboardWidgets()`, skip
 * block tersembunyi `is_visible=false`) — beda dari opsi B yang REAKTIF
 * (cache baru terisi begitu ada viewer & terjadi cache-miss). Dipanggil
 * scheduler (lihat `WarmDashboardCacheCommand`) lebih SERING drpd TTL cache
 * (`NumberCardService::$cacheDuration`/`ChartService::$cacheDuration`)
 * supaya cache praktis tidak pernah expire — viewer PERTAMA sekalipun sejak
 * dashboard dibuka tetap dapat cache-hit, bukan menunggu live query.
 *
 * `filters` yang dipakai warming SAMA PERSIS dgn yang dikirim block viewer
 * (`NumberCardDisplay`/`ChartDisplay`: `numberCard.filters`/`chart.filters`
 * — filter STATIS tersimpan di record, bukan per-viewer/per-instance-block)
 * — cache key hasil warming identik dgn yang nanti benar-benar di-request.
 *
 * Chart `group_by`: label relasi permission-dependent (lihat
 * `ChartService::getGroupByChartConfig()` Requirement G) — warming pakai
 * `PermissionChecker` KOSONG (asumsi user TANPA izin Select tambahan ke
 * relasi, kasus mayoritas). Viewer yang PUNYA izin tambahan itu tetap kena
 * cache-miss sekali (fallback aman ke query live) — bukan bug, cuma kasus
 * sempit yang sengaja tidak di-cover (2x cost warming utk manfaat tak pasti).
 *
 * `source_type`/`chart_source_type` custom SENGAJA di-skip — resolvernya
 * pluggable (`CustomChartSourceRegistry`), TIDAK lewat `Cache::remember`
 * sama sekali (lihat `NumberCardService::getValue()`/`ChartService::getData()`),
 * jadi warming di sini tidak ada gunanya (hasil tidak tersimpan buat dipakai
 * ulang).
 */
class DashboardCacheWarmerService {
    public function __construct(
        private NumberCardService $numberCardService,
        private ChartService $chartService,
    ) {}

    /** @return array{number_cards: int, charts: int} jumlah entri yang di-warm */
    public function warm(): array {
        return [
            'number_cards' => $this->warmNumberCards(),
            'charts'       => $this->warmCharts(),
        ];
    }

    private function warmNumberCards(): int {
        $cards = NumberCard::query()
            ->where(fn ($q) => $q->whereNull('source_type')->orWhere('source_type', '!=', 'custom'))
            ->whereHas('dashboardWidgets', fn ($q) => $q->where('is_visible', true))
            ->get();

        foreach ($cards as $card) {
            $filters = $card->filters ?? [];
            $value   = $this->numberCardService->getValue($card, $filters);
            $this->numberCardService->getPercentageDifference($card, $filters, $value);
        }

        return $cards->count();
    }

    private function warmCharts(): int {
        $checker = new PermissionChecker([]);

        $charts = Chart::query()
            ->where(fn ($q) => $q->whereNull('chart_source_type')->orWhere('chart_source_type', '!=', 'custom'))
            ->whereHas('dashboardWidgets', fn ($q) => $q->where('is_visible', true))
            ->get();

        foreach ($charts as $chart) {
            $this->chartService->getData($chart, $chart->filters ?? [], $checker, []);
        }

        return $charts->count();
    }
}

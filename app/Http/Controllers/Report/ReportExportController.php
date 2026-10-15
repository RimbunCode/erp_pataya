<?php

namespace App\Http\Controllers\Report;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Report\StockBalanceRow;
use App\Services\Core\PermissionChecker;
use App\Services\Report\ReportCatalog;
use App\Services\Report\ReportExporter;
use App\Services\Report\ReportFilterStore;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Endpoint unduh PDF dan CSV untuk seluruh laporan (spec modul-laporan, Req 7). Izin dicek pada
 * modul sumber setiap laporan, sama seperti halaman laporannya (Req 6.2).
 */
class ReportExportController extends Controller {
    /** Izin dicek manual pada modul sumber tiap laporan. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, StockBalanceRow::class);
    }

    public function export(
        Request $request,
        string $report,
        string $format,
        ReportCatalog $catalog,
        ReportFilterStore $filterStore,
        ReportExporter $exporter,
    ): Response {
        $definition = $catalog->find($report) ?? abort(404);

        if (! in_array($format, ['pdf', 'csv'], true)) {
            abort(404);
        }

        if (! PermissionChecker::forUser($request)->can($definition->permissionModel, Permission::Select)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, $definition->key, $definition->filterKeys);
        $filter = ($definition->makeFilter)($values);

        $kpi       = ($definition->kpi)($filter);
        $kpiValues = [];
        foreach ($definition->kpiLabels as $key => $label) {
            if (array_key_exists($key, $kpi->values)) {
                $kpiValues[$label] = $kpi->values[$key];
            }
        }

        $rows = $definition->rows($filter);

        if ($format === 'csv') {
            return response($exporter->csv($definition, $filter->toSummary(), $kpiValues, $rows), 200, [
                'Content-Type'        => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="' . $exporter->filename($definition, 'csv') . '"',
            ]);
        }

        return response($exporter->pdf($definition, $filter->toSummary(), $kpiValues, $rows), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $exporter->filename($definition, 'pdf') . '"',
        ]);
    }
}

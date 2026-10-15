<?php

namespace App\Http\Controllers\Report;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Report\StockBalanceRow;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Services\Report\ReportCatalog;
use App\Services\Report\ReportFilterStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Hitung ulang akurat KPI laporan (spec modul-laporan, Req 5.5 sampai 5.8). Hanya untuk
 * pengguna yang berizin administratif (User.manage_roles, Req 5.5 dan 5.8). KPI dijumlahkan di
 * aplikasi dari seluruh baris hasil filter melalui jalur tabel (Req 5.6), jadi hasilnya dijamin
 * konsisten dengan isi tabel.
 */
class ReportRecountController extends Controller {
    /** Izin dicek manual: modul sumber laporan dan izin administratif User. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, StockBalanceRow::class);
    }

    public function recount(
        Request $request,
        string $report,
        ReportCatalog $catalog,
        ReportFilterStore $filterStore,
    ): JsonResponse {
        $definition = $catalog->find($report) ?? abort(404);

        $checker = PermissionChecker::forUser($request);

        if (! $checker->canAction(User::class, 'manage_roles')) {
            abort(403);
        }

        if (! $checker->can($definition->permissionModel, Permission::Select)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, $definition->key, $definition->filterKeys);
        $filter = ($definition->makeFilter)($values);

        $rows = $definition->rows($filter);

        return response()->json([
            'values'   => ($definition->recount)($rows),
            'rowCount' => $rows->count(),
        ]);
    }
}

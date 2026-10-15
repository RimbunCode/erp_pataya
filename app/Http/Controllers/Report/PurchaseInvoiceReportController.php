<?php

namespace App\Http\Controllers\Report;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Report\PurchaseInvoiceReportRow;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Services\Report\PurchaseInvoice\PurchaseInvoiceFilter;
use App\Services\Report\PurchaseInvoice\PurchaseInvoiceKpiBuilder;
use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\ReportFilterOptions;
use App\Services\Report\ReportFilterStore;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Laporan Invoice Pembelian (spec modul-laporan, Req 13). Izin dicek pada modul Finances.
 */
class PurchaseInvoiceReportController extends Controller {
    private const REPORT_KEY = 'purchase_invoice';

    /** Izin dicek manual pada modul sumber (PurchaseInvoice), bukan pada model view laporan. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, PurchaseInvoiceReportRow::class);
    }

    public function index(
        Request $request,
        ReportFilterStore $filterStore,
        ReportFilterOptions $options,
        PurchaseInvoiceKpiBuilder $kpiBuilder,
        ReportConsistencyChecker $consistencyChecker,
    ): Response {
        if (! PermissionChecker::forUser($request)->can(PurchaseInvoice::class, Permission::Select)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, self::REPORT_KEY, PurchaseInvoiceFilter::KEYS);
        $filter = PurchaseInvoiceFilter::fromValues($values);

        // Jalur tabel: filter yang sama dengan jalur KPI (Req 4.1).
        $tableQuery = PurchaseInvoiceReportRow::query();
        $filter->applyTo($tableQuery);
        $tableQuery->dataTable($request);

        $paginator  = Inertia::getShared('data');
        $tableTotal = $paginator instanceof LengthAwarePaginator ? $paginator->total() : 0;

        $kpi = $kpiBuilder->build($filter);

        return Inertia::render('Report/PurchaseInvoice', [
            'report' => [
                'key'  => self::REPORT_KEY,
                'name' => __('report.purchase_invoice.title'),
            ],
            'canRecount'   => PermissionChecker::forUser($request)->canAction(User::class, 'manage_roles'),
            'breadcrumbs'  => [['name' => __('report.group')], ['name' => __('report.purchase_invoice.title')]],
            'filters'      => $filter->toSummary(),
            'filterValues' => $values,
            'filterFields' => [
                ['key' => 'date_from', 'label' => __('report.filter.date_from'), 'type' => 'date'],
                ['key' => 'date_to', 'label' => __('report.filter.date_to'), 'type' => 'date'],
                ['key' => 'supplier_id', 'label' => __('report.filter.supplier'), 'type' => 'select', 'options' => $options->suppliers()],
                ['key' => 'payment_status', 'label' => __('report.filter.status'), 'type' => 'select', 'options' => $this->paymentStatusOptions()],
            ],
            'kpi' => [
                ['key' => 'total_transaction', 'label' => __('report.purchase_invoice.kpi.total_transaction'), 'value' => $kpi->values['total_transaction'], 'type' => 'number'],
                ['key' => 'total_item', 'label' => __('report.purchase_invoice.kpi.total_item'), 'value' => $kpi->values['total_item'], 'type' => 'number'],
                ['key' => 'dpp_value', 'label' => __('report.purchase_invoice.kpi.dpp_value'), 'value' => $kpi->values['dpp_value'], 'type' => 'currency'],
                ['key' => 'tax_value', 'label' => __('report.purchase_invoice.kpi.tax_value'), 'value' => $kpi->values['tax_value'], 'type' => 'currency'],
                ['key' => 'outstanding_amount', 'label' => __('report.purchase_invoice.kpi.outstanding_amount'), 'value' => $kpi->values['outstanding_amount'], 'type' => 'currency'],
            ],
            'consistency' => $consistencyChecker->check(
                __('report.purchase_invoice.title'),
                $kpi,
                $tableTotal,
                $filter->toSummary(),
                $request,
            ),
        ]);
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function paymentStatusOptions(): array {
        return collect(PurchaseInvoiceFilter::PAYMENT_STATUSES)
            ->map(fn (string $status) => ['value' => $status, 'label' => __('report.purchase_invoice.payment.' . $status)])
            ->values()
            ->all();
    }
}

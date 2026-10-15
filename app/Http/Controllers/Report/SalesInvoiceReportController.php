<?php

namespace App\Http\Controllers\Report;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Finances\SalesInvoice;
use App\Models\Report\SalesInvoiceReportRow;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\ReportFilterOptions;
use App\Services\Report\ReportFilterStore;
use App\Services\Report\SalesInvoice\SalesInvoiceFilter;
use App\Services\Report\SalesInvoice\SalesInvoiceKpiBuilder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Laporan Invoice Penjualan (spec modul-laporan, Req 11). Izin dicek pada modul Finances.
 */
class SalesInvoiceReportController extends Controller {
    private const REPORT_KEY = 'sales_invoice';

    /** Izin dicek manual pada modul sumber (SalesInvoice), bukan pada model view laporan. */
    protected bool $ignorePermission = true;

    public function __construct(Request $request) {
        parent::__construct($request, SalesInvoiceReportRow::class);
    }

    public function index(
        Request $request,
        ReportFilterStore $filterStore,
        ReportFilterOptions $options,
        SalesInvoiceKpiBuilder $kpiBuilder,
        ReportConsistencyChecker $consistencyChecker,
    ): Response {
        if (! PermissionChecker::forUser($request)->can(SalesInvoice::class, Permission::Select)) {
            abort(403);
        }

        $values = $filterStore->resolve($request, self::REPORT_KEY, SalesInvoiceFilter::KEYS);
        $filter = SalesInvoiceFilter::fromValues($values);

        // Jalur tabel: filter yang sama dengan jalur KPI (Req 4.1).
        $tableQuery = SalesInvoiceReportRow::query();
        $filter->applyTo($tableQuery);
        $tableQuery->dataTable($request);

        $paginator  = Inertia::getShared('data');
        $tableTotal = $paginator instanceof LengthAwarePaginator ? $paginator->total() : 0;

        $kpi = $kpiBuilder->build($filter);

        return Inertia::render('Report/SalesInvoice', [
            'report' => [
                'key'  => self::REPORT_KEY,
                'name' => __('report.sales_invoice.title'),
            ],
            'canRecount'   => PermissionChecker::forUser($request)->canAction(User::class, 'manage_roles'),
            'breadcrumbs'  => [['name' => __('report.group')], ['name' => __('report.sales_invoice.title')]],
            'filters'      => $filter->toSummary(),
            'filterValues' => $values,
            'filterFields' => [
                ['key' => 'date_from', 'label' => __('report.filter.date_from'), 'type' => 'date'],
                ['key' => 'date_to', 'label' => __('report.filter.date_to'), 'type' => 'date'],
                ['key' => 'customer_id', 'label' => __('report.filter.customer'), 'type' => 'select', 'options' => $options->customers()],
                ['key' => 'payment_status', 'label' => __('report.filter.status'), 'type' => 'select', 'options' => $this->paymentStatusOptions()],
            ],
            'kpi' => [
                ['key' => 'total_transaction', 'label' => __('report.sales_invoice.kpi.total_transaction'), 'value' => $kpi->values['total_transaction'], 'type' => 'number'],
                ['key' => 'total_item', 'label' => __('report.sales_invoice.kpi.total_item'), 'value' => $kpi->values['total_item'], 'type' => 'number'],
                ['key' => 'total_amount', 'label' => __('report.sales_invoice.kpi.total_amount'), 'value' => $kpi->values['total_amount'], 'type' => 'currency'],
                ['key' => 'tax_value', 'label' => __('report.sales_invoice.kpi.tax_value'), 'value' => $kpi->values['tax_value'], 'type' => 'currency'],
                ['key' => 'outstanding_amount', 'label' => __('report.sales_invoice.kpi.outstanding_amount'), 'value' => $kpi->values['outstanding_amount'], 'type' => 'currency'],
            ],
            'consistency' => $consistencyChecker->check(
                __('report.sales_invoice.title'),
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
        return collect(SalesInvoiceFilter::PAYMENT_STATUSES)
            ->map(fn (string $status) => ['value' => $status, 'label' => __('report.sales_invoice.payment.' . $status)])
            ->values()
            ->all();
    }
}

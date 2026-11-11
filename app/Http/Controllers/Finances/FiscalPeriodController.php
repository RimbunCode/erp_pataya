<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\FiscalEnforcementRequest;
use App\Http\Requests\Finances\FiscalPeriodStatusRequest;
use App\Http\Requests\Finances\FiscalYearGenerateRequest;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Halaman pengaturan Periode Fiskal (Finance Fase 1, Requirement 11.4-11.5, 14.1): daftar tahun/periode, generate
 * tahun kalender, buka/tutup periode (izin `close_period`/`reopen_period`), dan toggle penegakan periode (izin
 * `write` pada `FinanceSetting`). Tidak ada atribut periode yang diterima dari request.
 */
class FiscalPeriodController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, FiscalPeriod::class);
    }

    protected function enforcePermission(string $method) {
        return match ($method) {
            'generate'          => 'create',
            'close'             => 'close_period',
            'open'              => 'reopen_period',
            'updateEnforcement' => 'select',
            default             => parent::enforcePermission($method),
        };
    }

    public function index(Request $request, SettingsService $settings, FiscalPeriodService $periods): Response {
        $this->setBreadcrumbs();

        $years = FiscalYear::query()
            ->with('periods')
            ->orderByDesc('start_date')
            ->get()
            ->map(fn (FiscalYear $year) => [
                'id'         => $year->id,
                'name'       => $year->name,
                'start_date' => $year->start_date->toDateString(),
                'end_date'   => $year->end_date->toDateString(),
                'status'     => $year->status,
                'periods'    => $year->periods->map(fn (FiscalPeriod $period) => [
                    'id'         => $period->id,
                    'name'       => $period->name,
                    'start_date' => $period->start_date->toDateString(),
                    'end_date'   => $period->end_date->toDateString(),
                    'status'     => $period->status,
                    'closed_at'  => $period->closed_at,
                ])->all(),
            ])
            ->all();

        return Inertia::render('Finances/FiscalPeriods/Index', [
            'fiscalYears'         => $years,
            'enforceFiscalPeriod' => (bool) $settings->getForRead(FinanceSetting::class)->enforce_fiscal_period,
            'uncoveredCount'      => $periods->uncoveredTransactionCount(),
            'canGenerate'         => $this->hasPermission('create'),
            'canClose'            => $this->hasPermission('close_period'),
            'canReopen'           => $this->hasPermission('reopen_period'),
            'canEnforce'          => FinanceSetting::hasPermission('write'),
            'defaultYear'         => (int) now($periods->companyTimezone())->format('Y'),
        ]);
    }

    /**
     * Periode fiskal tidak punya halaman detail; tautan relasi pada daftar Jurnal (`fiscalPeriods.show`) membawa
     * pengguna ke halaman pengaturan periode.
     */
    public function show(FiscalPeriod $fiscalPeriod): RedirectResponse {
        return redirect()->route('fiscalPeriods.index');
    }

    public function generate(FiscalYearGenerateRequest $request, FiscalPeriodService $periods): RedirectResponse {
        $year = $periods->generateYear((int) $request->validated('year'));

        return back()->with('success', __('finances/fiscalPeriod.generate.success', ['year' => $year->name]));
    }

    public function close(FiscalPeriodStatusRequest $request, FiscalPeriod $fiscalPeriod, FiscalPeriodService $periods): RedirectResponse {
        $periods->close($fiscalPeriod, $request->validated('reason'));

        return back()->with('success', __('finances/fiscalPeriod.close.success', ['period' => $fiscalPeriod->name]));
    }

    public function open(FiscalPeriodStatusRequest $request, FiscalPeriod $fiscalPeriod, FiscalPeriodService $periods): RedirectResponse {
        $periods->open($fiscalPeriod, $request->validated('reason'));

        return back()->with('success', __('finances/fiscalPeriod.open.success', ['period' => $fiscalPeriod->name]));
    }

    public function updateEnforcement(FiscalEnforcementRequest $request, SettingsService $settings): RedirectResponse {
        abort_unless(FinanceSetting::hasPermission('write'), 403);

        $settings->update(FinanceSetting::class, ['enforce_fiscal_period' => $request->boolean('enforce_fiscal_period')]);

        return back()->with('success', __('finances/fiscalPeriod.enforcement.saved'));
    }

    private function hasPermission(string $action): bool {
        try {
            FiscalPeriod::_checkPermission($action);
        } catch (HttpException) {
            return false;
        }

        return true;
    }
}

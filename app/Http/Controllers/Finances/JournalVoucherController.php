<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\JournalVoucherRequest;
use App\Models\Finances\JournalVoucher;
use App\Services\Finances\JournalVoucherService;
use App\Services\Finances\Ledger\JournalService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class JournalVoucherController extends Controller {
    public function __construct(Request $request, JournalVoucherService $service) {
        $this->service = $service;
        parent::__construct($request, JournalVoucher::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        JournalVoucher::dataTable($request);

        return Inertia::render('Finances/JournalVouchers/Index', [
            'minorUnit' => $this->minorUnit(),
        ]);
    }

    public function create() {
        $this->setBreadcrumbs('finances.journalVoucher.new');

        return Inertia::render('Finances/JournalVouchers/Show', [
            'defaultData' => ['date' => now()],
            'minorUnit'   => $this->minorUnit(),
        ]);
    }

    public function store(JournalVoucherRequest $request) {
        $voucher = $this->service->create($request->validated());

        return redirect()->route('journalVouchers.show', $voucher)->with('id', $voucher->id);
    }

    public function show(JournalVoucher $journalVoucher) {
        $this->setBreadcrumbs($journalVoucher);
        $journalVoucher->showDetail();

        return Inertia::render('Finances/JournalVouchers/Show', [
            'journalVoucher' => function () use ($journalVoucher) {
                $journalVoucher->loadRelations([], withTrashed: true);

                return $journalVoucher;
            },
            'minorUnit' => $this->minorUnit(),
        ]);
    }

    public function update(JournalVoucherRequest $request, JournalVoucher $journalVoucher) {
        $this->service->update($journalVoucher, $request->validated());

        return back();
    }

    public function submit(JournalVoucher $journalVoucher) {
        $this->service->submit($journalVoucher);

        return back();
    }

    /**
     * Jumlah desimal mata uang dasar; dipakai form untuk indikator seimbang dalam minor unit (sama dengan `JournalService`).
     */
    private function minorUnit(): int {
        return app(JournalService::class)->baseCurrency()[1];
    }
}

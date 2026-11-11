<?php

namespace App\Http\Controllers\Finances;

use App\Enums\FormStatus;
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

    /**
     * Amend hanya untuk voucher yang dibatalkan atau ditolak (keputusan pemilik produk 2026-11-12). Guard generik
     * `Submitable` tidak memeriksa status di server; voucher langsung memengaruhi buku besar, jadi salinan dari
     * voucher yang sudah diposting atau masih berjalan ditolak (UI juga hanya menampilkan Amend pada status itu).
     */
    public function amend(string $id) {
        $voucher  = JournalVoucher::query()->findOrFail($id);
        $statuses = collect($voucher->status)->map(fn ($status) => $status instanceof FormStatus ? $status : FormStatus::tryFrom((string) $status));

        abort_unless($statuses->contains(FormStatus::CANCELED) || $statuses->contains(FormStatus::REJECTED), 422);

        return parent::amend($id);
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

<?php

namespace App\Http\Controllers\Asset;

use App\Enums\PostingDocumentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssetValueAdjustmentRequest;
use App\Models\Asset\AssetValueAdjustment;
use App\Services\Asset\AssetValueAdjustmentService;
use App\Services\Finances\Posting\PostingModeResolver;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AssetValueAdjustmentController extends Controller {
    private AssetValueAdjustmentService $assetValueAdjustmentService;

    public function __construct(Request $request) {
        parent::__construct($request, AssetValueAdjustment::class);
        $this->assetValueAdjustmentService = app(AssetValueAdjustmentService::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        AssetValueAdjustment::dataTable($request);

        return Inertia::render('Asset/ValueAdjustments/Index');
    }

    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Asset/ValueAdjustments/Show', [
            'accountsManagedByEngine' => $this->accountsManagedByEngine(),
        ]);
    }

    /**
     * Saat engine `on`, akun selisih ditentukan engine saat posting sehingga form tidak meminta akun (Finance Fase 2,
     * Task 12.3, Requirement 13.1). Mode `off`/`shadow` masih membaca kolom akun dokumen.
     */
    private function accountsManagedByEngine(): bool {
        return app(PostingModeResolver::class)->isOn(PostingDocumentType::AssetValueAdjustment);
    }

    public function store(AssetValueAdjustmentRequest $request) {
        $adjustment = $this->assetValueAdjustmentService->create($request->validated());

        return redirect()->route('assetValueAdjustments.show', $adjustment)->with('id', $adjustment->id);
    }

    public function show(AssetValueAdjustment $assetValueAdjustment) {
        $this->setBreadcrumbs($assetValueAdjustment);
        $assetValueAdjustment->showDetail();

        return Inertia::render('Asset/ValueAdjustments/Show', [
            'assetValueAdjustment' => function () use ($assetValueAdjustment) {
                $assetValueAdjustment->loadRelations();

                return $assetValueAdjustment;
            },
            'accountsManagedByEngine' => $this->accountsManagedByEngine(),
        ]);
    }

    public function update(AssetValueAdjustmentRequest $request, AssetValueAdjustment $assetValueAdjustment) {
        $this->assetValueAdjustmentService->update($assetValueAdjustment, $request->validated());

        return back();
    }

    public function submit(AssetValueAdjustment $assetValueAdjustment) {
        $this->assetValueAdjustmentService->submit($assetValueAdjustment);

        return back();
    }
}

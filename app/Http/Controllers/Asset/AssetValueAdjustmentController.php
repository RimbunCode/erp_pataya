<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssetValueAdjustmentRequest;
use App\Models\Asset\AssetValueAdjustment;
use App\Services\Asset\AssetValueAdjustmentService;
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

        return Inertia::render('Asset/ValueAdjustments/Show');
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

<?php

namespace App\Http\Controllers\Asset;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssetMovementRequest;
use App\Models\Asset\AssetMovement;
use App\Services\Asset\AssetMovementService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AssetMovementController extends Controller {
    private AssetMovementService $assetMovementService;

    public function __construct(Request $request) {
        parent::__construct($request, AssetMovement::class);
        $this->assetMovementService = app(AssetMovementService::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        AssetMovement::dataTable($request);

        return Inertia::render('Asset/Movements/Index');
    }

    public function create(Request $request) {
        $this->setBreadcrumbs();

        if ($assetId = $request->query('asset_id')) {
            $existingDraft = AssetMovement::whereHas('items', fn ($q) => $q->where('asset_id', $assetId))
                ->where('created_by_id', $request->user()->id)
                ->get()
                ->first(fn (AssetMovement $movement) => in_array(FormStatus::DRAFT, $movement->status ?? [], true));

            if ($existingDraft) {
                return redirect()->route('assetMovements.show', $existingDraft);
            }
        }

        return Inertia::render('Asset/Movements/Show');
    }

    public function store(AssetMovementRequest $request) {
        $movement = $this->assetMovementService->create($request->validated());

        return redirect()->route('assetMovements.show', $movement)->with('id', $movement->id);
    }

    public function show(AssetMovement $assetMovement) {
        $this->setBreadcrumbs($assetMovement);
        $assetMovement->showDetail();

        return Inertia::render('Asset/Movements/Show', [
            'assetMovement' => function () use ($assetMovement) {
                $assetMovement->loadRelations();

                return $assetMovement;
            },
        ]);
    }

    public function update(AssetMovementRequest $request, AssetMovement $assetMovement) {
        $this->assetMovementService->update($assetMovement, $request->validated());

        return back();
    }

    public function submit(AssetMovement $assetMovement) {
        $this->assetMovementService->submit($assetMovement);

        return back();
    }
}

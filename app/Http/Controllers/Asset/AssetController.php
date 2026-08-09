<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssetRequest;
use App\Models\Asset\Asset;
use App\Services\Asset\AssetService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use LogicException;

class AssetController extends Controller {
    private AssetService $assetService;

    public function __construct(Request $request) {
        parent::__construct($request, Asset::class);
        $this->assetService = app(AssetService::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        Asset::dataTable($request);

        return Inertia::render('Asset/Assets/Index');
    }

    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Asset/Assets/Show');
    }

    public function store(AssetRequest $request) {
        $data  = $request->validated();
        $asset = $this->assetService->create($data);

        return redirect()->route('assets.show', $asset)->with('id', $asset->id);
    }

    public function show(Asset $asset) {
        $this->setBreadcrumbs($asset);
        $asset->showDetail();

        return Inertia::render('Asset/Assets/Show', [
            'asset' => function () use ($asset) {
                $asset->loadRelations();

                return $asset;
            },
        ]);
    }

    public function update(AssetRequest $request, Asset $asset) {
        $this->assetService->update($asset, $request->validated());

        return back();
    }

    public function submit(Asset $asset) {
        $this->assetService->submit($asset);

        return back();
    }

    public function action(Asset $asset, string $action) {
        return DB::transaction(function () use ($asset, $action) {
            match ($action) {
                'scrap'            => $asset->scrap(),
                'setInMaintenance' => $asset->setInMaintenance(),
                'setOutOfOrder'    => $asset->setOutOfOrder(),
                'reactivate'       => $asset->reactivate(),
                'sell'             => throw new LogicException(__('asset/asset.sell_not_implemented')),
                default            => abort(404, "Unknown action: {$action}"),
            };

            return back();
        });
    }
}

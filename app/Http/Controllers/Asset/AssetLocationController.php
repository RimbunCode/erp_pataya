<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssetLocationRequest;
use App\Models\Asset\AssetLocation;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AssetLocationController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, AssetLocation::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        AssetLocation::dataTable($request);

        return Inertia::render('Asset/Locations/Index');
    }

    public function create() {
        $this->setBreadcrumbs();

        return $this->renderShow(
            'Asset/Locations/Form',
            'assetLocation',
            null,
            new ($this->model),
        );
    }

    public function store(AssetLocationRequest $request) {
        $data     = $request->validated();
        $location = AssetLocation::create($data);

        return redirect()->back()->with('id', $location->id);
    }

    public function show(AssetLocation $assetLocation) {
        $this->setBreadcrumbs($assetLocation);
        $assetLocation->showDetail();
        $assetLocation->loadRelations();

        return $this->renderShow(
            'Asset/Locations/Form',
            'assetLocation',
            $assetLocation->location_name,
            $assetLocation,
        );
    }

    public function update(AssetLocationRequest $request, AssetLocation $assetLocation) {
        $assetLocation->fill($request->validated());
        $assetLocation->save();

        return back();
    }
}

<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssetCategoryRequest;
use App\Models\Asset\AssetCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AssetCategoryController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, AssetCategory::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        AssetCategory::dataTable($request);

        return Inertia::render('Asset/Categories/Index');
    }

    public function create() {
        $this->setBreadcrumbs();

        return $this->renderShow(
            'Asset/Categories/Form',
            'assetCategory',
            null,
            new ($this->model),
        );
    }

    public function store(AssetCategoryRequest $request) {
        $data     = $request->validated();
        $category = AssetCategory::create($data);

        return redirect()->back()->with('id', $category->id);
    }

    public function show(AssetCategory $assetCategory) {
        $this->setBreadcrumbs($assetCategory);
        $assetCategory->showDetail();
        $assetCategory->loadRelations();

        return $this->renderShow(
            'Asset/Categories/Form',
            'assetCategory',
            $assetCategory->category_name,
            $assetCategory,
        );
    }

    public function update(AssetCategoryRequest $request, AssetCategory $assetCategory) {
        $assetCategory->fill($request->validated());
        $assetCategory->save();

        return back();
    }
}

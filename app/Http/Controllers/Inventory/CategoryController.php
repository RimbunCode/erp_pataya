<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\CategoryRequest;
use App\Models\Inventory\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CategoryController extends Controller {
  public function __construct(Request $request) {
    parent::__construct($request, Category::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    Category::dataTable($request);
    return Inertia::render(
      'Inventory/Categories/Index',
      [
        'types' => [
          'stock' => __('core/category.types.stock'),
          'vehicle' => __('core/category.types.vehicle'),
          'service' => __('core/category.types.service'),
        ]
      ]
    );
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create() {
    //
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(CategoryRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();
    $category = Category::create($data);
    $category->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user created this',
        'id' => ':user telah membuat ini',
      ]
    ]);
    DB::commit();
    return redirect()->back();
  }

  /**
   * Display the specified resource.
   */
  public function show(Category $category) {
    $this->setBreadcrumbs($category);
    $category->showDetail();
    return Inertia::render('Inventory/Categories/Show', [
      'category' => $category,
      'types' => [
        'stock' => __('core/category.types.stock'),
        'vehicle' => __('core/category.types.vehicle'),
        'service' => __('core/category.types.service'),
      ]
    ]);
  }
  /**
   * Update the specified resource in storage.
   */
  public function update(CategoryRequest $request, Category $category) {
    $data = $request->validated();
    DB::beginTransaction();
    $category->update($data);
    $category->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user updated this',
        'id' => ':user telah memperbarui ini',
      ]
    ]);
    DB::commit();
    return redirect()->back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Category $category) {
    $category->delete();
    return redirect()->back();
  }
}

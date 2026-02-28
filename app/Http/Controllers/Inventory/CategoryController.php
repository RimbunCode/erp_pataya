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
    $category->logForCreated();
    DB::commit();
    return redirect()->back()->with('id', $category->id);
  }

  /**
   * Display the specified resource.
   */
  public function show(Category $category) {
    $this->setBreadcrumbs($category);
    $category->showDetail();
    return $this->renderShow(
      'Inventory/Categories/Form',
      "category",
      $category->name,
      $category,
    );
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(CategoryRequest $request, Category $category) {
    $data = $request->validated();
    DB::beginTransaction();
    $category->fillForUpdate($data);
    $category->logForUpdated();
    DB::commit();
    // dd($request->all());
    return back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Category $category) {
    DB::beginTransaction();
    $category->delete();
    $category->logForDeleted();
    DB::commit();
    return redirect()->route('categories.index');
  }
}

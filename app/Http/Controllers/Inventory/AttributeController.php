<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\AttributeRequest;
use App\Models\Inventory\Attribute;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AttributeController extends Controller {
  public function __construct(Request $request) {
    parent::__construct($request, Attribute::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    Attribute::dataTable($request);
    return Inertia::render('Inventory/Attributes/Index');
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(AttributeRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();
    if (($data['is_numeric'] ?? false) == true) {
      $data['values'] = array_map(fn($value) => [
        'value' => $value
      ], range($data['from_range'], $data['to_range'], $data['increment']));
    }

    $attribute = Attribute::create($data);
    $attribute->logs()->create([
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
  public function show(Attribute $attribute) {
    $this->setBreadcrumbs($attribute);
    $attribute->showDetail();
    if ($attribute->is_numeric) {
      $attribute->from_range = $attribute->values[0]['value'] ?? 0;
      $attribute->to_range = $attribute->values[count($attribute->values) - 1]['value'] ?? 0;
      $attribute->increment = ($attribute->values[1]['value'] ?? 0) - ($attribute->values[0]['value'] ?? 0);
    }
    return Inertia::render('Inventory/Attributes/Show', [
      'attribute' => $attribute,
    ]);
  }


  /**
   * Update the specified resource in storage.
   */
  public function update(AttributeRequest $request, Attribute $attribute) {
    $data = $request->validated();
    DB::beginTransaction();
    if (($data['is_numeric'] ?? false) == true) {
      $data['values'] = array_map(fn($value) => [
        'value' => $value
      ], range($data['from_range'], $data['to_range'], $data['increment']));
    }
    $attribute->update($data);
    $attribute->logs()->create([
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
  public function destroy(Request $request, Attribute $attribute) {
    DB::beginTransaction();
    $attribute->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user deleted this',
        'id' => ':user telah menghapus ini',
      ]
    ]);
    $attribute->delete();
    DB::commit();
    return redirect()->back();
  }
}

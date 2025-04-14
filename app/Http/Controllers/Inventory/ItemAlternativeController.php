<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\ItemAlternativeRequest;
use App\Models\Inventory\ItemAlternative;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ItemAlternativeController extends Controller {
  public function __construct(Request $request) {
    parent::__construct($request, ItemAlternative::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    ItemAlternative::leftJoin('items as item', 'item.id', '=', 'item_alternatives.item_id')
      ->leftJoin('items as alternative', 'alternative.id', '=', 'item_alternatives.alternative_item_id')
      ->select(['item.code as item_code', 'alternative.code as alternative_code'])
      ->dataTable($request);
    return Inertia::render('Inventory/ItemAlternatives/Index');
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create(Request $request) {
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(ItemAlternativeRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();
    $itemAlternative = ItemAlternative::create(
      [
        'item_id' => $data['item']['id'],
        'alternative_item_id' => $data['alternative']['id'],
        'two_way' => $data['two_way'] ?? false,
      ]
    );
    $itemAlternative->logs()->create([
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
  public function show(ItemAlternative $itemAlternative) {
    $this->setBreadcrumbs($itemAlternative);
    $itemAlternative->showDetail();
    return Inertia::render('Inventory/ItemAlternatives/Show', [
      'itemAlternative' => $itemAlternative,
    ]);
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function edit(ItemAlternative $itemAlternative) {
    //
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(ItemAlternativeRequest $request, ItemAlternative $itemAlternative) {
    $data = $request->validated();
    DB::beginTransaction();
    $itemAlternative->update(
      [
        'item_id' => $data['item']['id'],
        'alternative_item_id' => $data['alternative']['id'],
        'two_way' => $data['two_way'] ?? false,
      ]
    );
    $itemAlternative->logs()->create([
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
  public function destroy(ItemAlternative $itemAlternative) {
    $itemAlternative->delete();
    return redirect()->back();
  }
}

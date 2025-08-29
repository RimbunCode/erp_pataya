<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\ItemVariantRequest;
use App\Models\Core\Branch;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Services\Inventory\ItemServices;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;

class ItemVariantController extends Controller {
  private $itemService;
  public function __construct(Request $request, ItemServices $itemService) {
    $this->itemService = $itemService;
    parent::__construct($request, ItemVariant::class);
  }
  public function index(Request $request) {
    return \redirect()->route('items.index');
  }
  public function show(ItemVariant $itemVariant) {
    $item = $itemVariant->item;
    $this->setBreadcrumbs($item, $itemVariant);
    $itemVariant->showDetail();
    return Inertia::render('Inventory/Items/ShowVariant', [
      'itemVariant' => function () use ($itemVariant) {
        $itemVariant->loadRelations();
        return $itemVariant;
      },
      'stocks' => Inertia::defer(function () use ($itemVariant) {
        $warehouses = Warehouse::with(['stocks' => fn($query) => $query->where('item_variant_id', $itemVariant->id), 'stocks.unit', 'branch']);
        if (Session::has('currentBranch')) {
          $branch = Branch::find(Session::get('currentBranch'));
          if (!$branch->is_main_branch) {
            $warehouses->where('warehouses.branch_id', $branch->id);
          }
        }
        $warehouses = $warehouses->get()
          ->map(fn($warehouse) => [
            ...$warehouse->toArray(),
            'actual_stock' => $warehouse->stocks->sum('quantity'),
            'reserved_stock' => 0,
          ]);
        return $warehouses;
      }),
    ]);
  }

  public function update(ItemVariantRequest $request, ItemVariant $itemVariant) {
    $data = $request->validated();
    $itemVariant->fillForUpdate($data);
    $this->itemService->updateBarcodes($itemVariant, $data['barcodes']);
    $itemVariant->logForUpdated();
    return back();
  }
}

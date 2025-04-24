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
  public function show(ItemVariant $variant) {
    $item = $variant->item;
    $this->setBreadcrumbs($item, $variant);
    $variant->showDetail();
    return Inertia::render('Inventory/Items/ShowVariant', [
      'variant' => function () use ($variant) {
        $variant->load(['barcodes']);
        return $variant;
      },
      'item' => function () use ($item) {
        $item->load(['category', 'defaultUnit',]);
        return $item;
      },
      'stocks' => Inertia::defer(function () use ($variant) {
        $warehouses = Warehouse::with(['stocks' => fn($query) => $query->where('item_variant_id', $variant->id), 'stocks.unit', 'branch']);
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
      'barcodes' => Inertia::defer(function () use ($variant) {
        return $variant->barcodes()->with(['unit'])->get();
      }),
    ]);
  }

  public function update(ItemVariantRequest $request, ItemVariant $variant) {
    $data = $request->validated();
    $variant->update($data);
    $this->itemService->updateBarcodes($variant, $data['barcodes']);
    return redirect()->back();
  }
}

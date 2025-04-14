<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Models\Core\Branch;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;

class ItemVariantController extends Controller {
  public function __construct(request $request) {
    parent::__construct($request, ItemVariant::class);
  }
  public function show(ItemVariant $variant) {
    $item = $variant->item;
    $this->setBreadcrumbs($item, $variant);
    $variant->showDetail();
    return Inertia::render('Inventory/Items/ShowVariant', [
      'variant' => $variant,
      'item' => function () use ($item) {
        $item->load(['category', 'defaultUnit']);
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
}

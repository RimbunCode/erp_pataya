<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\ItemRequest;
use App\Models\Core\Branch;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\ItemVariantAttribute;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Services\Inventory\ItemServices;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;

class ItemController extends Controller {
  protected $service;
  public function __construct(Request $request, ItemServices $service) {
    $this->service = $service;
    parent::__construct($request, Item::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    Item::with(['variants'])
      ->leftJoin('categories', 'categories.id', '=', 'items.category_id')
      ->leftJoin('units', 'units.id', '=', 'items.default_unit_id')
      ->select([
        'categories.name as category_name',
        'units.name as default_unit_name',
      ])
      ->dataTable($request);
    return Inertia::render('Inventory/Items/Index');
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
  public function store(ItemRequest $request) {
    $data = $request->validated();
    $data['category_id'] = $data['category']['id'];
    $data['default_unit_id'] = $data['default_unit']['id'];

    DB::beginTransaction();
    $item = Item::create($data);
    $this->service->updateUom($item, $data['uoms']);
    $itemVariant = $this->service->updateVariants($item, $data['format_variant'] ?? "", $data['variants'] ?? []);
    $this->service->updateBarcodes($itemVariant, $data['barcodes'] ?? []);
    $item->logForCreated();
    DB::commit();
    if ($itemVariant) {
      return back()->with('id', $itemVariant->id);
    }
    return back();
  }

  /**
   * Display the specified resource.
   */
  public function show(Item $item) {
    $this->setBreadcrumbs($item);
    $item->showDetail();

    return Inertia::render('Inventory/Items/Show', [
      'item' => function () use ($item) {
        $item->loadRelations();
        $itemArray = $item->toArray();

        $variant = $item->variants
          ->whereNull('format_variant')
          ->first();
        if ($variant) {
          $itemArray['barcodes'] = $variant->barcodes()->with(['unit'])->get();
        }
        return $itemArray;
      },
      'variants' => Inertia::defer(function () use ($item) {
        return ItemVariant::with(['values', 'stocks'])
          ->where('item_id', $item->id)
          ->orderBy('format_variant', 'asc')
          ->get()
          ->map(function ($variant) {
            $totalStock = $variant->stocks->sum('quantity');

            return [
              'id' => $variant->id,
              'sku' => $variant->sku,
              'total_stock' => $totalStock
            ];
          });
      }),
      'stocks' => Inertia::defer(function () use ($item) {
        $variant = ItemVariant::where('item_id', $item->id)
          ->whereNull('format_variant')
          ->first();
        if (!$variant) return [];
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
    ]);
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(ItemRequest $request, Item $item) {
    $data = $request->validated();
    $data['category_id'] = $data['category']['id'];
    $data['default_unit_id'] = $data['default_unit']['id'];

    DB::beginTransaction();
    $item->fillForUpdate($data);
    $this->service->updateUom($item, $data['uoms']);
    $itemVariant = $this->service->updateVariants($item, $data['format_variant'] ?? "", $data['attributes'] ?? []);
    $this->service->updateBarcodes($itemVariant, $data['barcodes'] ?? []);
    $item->logForUpdated();


    DB::commit();
    return back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Item $item) {
    DB::beginTransaction();
    $item->delete();
    $item->logForDeleted();
    DB::commit();
    return back();
  }
}

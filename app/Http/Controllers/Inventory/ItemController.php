<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\ItemRequest;
use App\Models\Inventory\Category;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Services\Inventory\ItemServices;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ItemController extends Controller {
    protected ItemServices $service;

    public function __construct(Request $request, ItemServices $service) {
        $this->service = $service;
        parent::__construct($request, Item::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        Item::dataTable($request);

        return Inertia::render('Inventory/Items/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Inventory/Items/Show');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(ItemRequest $request) {
        $data                    = $request->validated();
        $data['category_id']     = $data['category']['id'];
        $data['default_unit_id'] = $data['default_unit']['id'];
        $data['uoms']            = $this->service->sanitizeUoms($data['default_unit_id'], $data['uoms'] ?? []);

        $data['conversion_factor'] = $this->service->resolveDefaultUnitConversionFactor(
            $data['default_unit_id'],
            $data['uoms'],
        );

        DB::beginTransaction();
        $category              = Category::find($data['category_id']);
        $data['is_stock_item'] = $category->type != 'service';
        $data['type']          = $category->type;
        $item                  = Item::create($data);
        $this->service->updateUom($item, $data['uoms']);
        $itemVariant = $this->service->updateVariants($item, $data['format_variant'] ?? '', $data['attributes'] ?? []);
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

        $variant = ItemVariant::where('item_id', $item->id)
            ->whereNull('format_variant')
            ->first();
        if ($variant) {
            $variant->showStocks();
        }

        return Inertia::render('Inventory/Items/Show', [
            'item'     => function () use ($item) {
                $item->loadRelations();
                $item->uoms = $item->uoms();
                $itemArray  = $item->toArray();

                $variant = $item->variants
                    ->whereNull('format_variant')
                    ->first();
                if ($variant) {
                    $itemArray['barcodes'] = $variant->barcodes()->with(['unit'])->get();
                }

                return $itemArray;
            },
            'variants' => Inertia::defer(function () use ($item) {
                return ItemVariant::with(['stocks'])
                    ->where('item_id', $item->id)
                    ->orderBy('format_variant', 'asc')
                    ->get()
                    ->map(function (ItemVariant $variant) {
                        $totalStock = $variant->stocks->sum('quantity');

                        return [
                            ...$variant->toArray(),
                            'total_stock' => $totalStock,
                        ];
                    });
            }),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(ItemRequest $request, Item $item) {
        $data                = $request->validated();
        $data['category_id'] = $data['category']['id'];
        if (! $item->have_transactions) {
            $data['default_unit_id'] = $data['default_unit']['id'];
        } else {
            $data['default_unit_id'] = $item->default_unit_id;
        }
        $data['uoms']              = $this->service->sanitizeUoms($data['default_unit_id'], $data['uoms'] ?? []);
        $data['conversion_factor'] = $this->service->resolveDefaultUnitConversionFactor(
            $data['default_unit_id'],
            $data['uoms'],
        );

        DB::beginTransaction();
        $category              = Category::find($data['category_id']);
        $data['is_stock_item'] = $category->type != 'service';
        $data['type']          = $category->type;
        $item->fillForUpdate($data);
        $this->service->updateUom($item, $data['uoms']);
        $itemVariant = $this->service->updateVariants($item, $data['format_variant'] ?? '', $data['attributes'] ?? []);
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

        return redirect()->route('items.index');
    }
}

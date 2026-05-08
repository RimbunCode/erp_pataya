<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\ItemVariantRequest;
use App\Models\Core\Branch;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\Warehouse;
use App\Services\Inventory\ItemServices;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;

class ItemVariantController extends Controller {
    private $itemService;

    protected function enforcePermission($method) {
        if ($method == 'info') {
            return true;
        }
    }

    public function __construct(Request $request, ItemServices $itemService) {
        $this->itemService = $itemService;
        parent::__construct($request, ItemVariant::class);
    }

    public function index(Request $request) {
        return \redirect()->route('items.index');
    }

    public function info(Request $request) {
        $data           = $request->data ?? [];
        $idChanges      = array_flip($request->idChanges ?? []);
        $totalIdChanges = count($idChanges);

        $result = [];

        // 1. Ambil pasangan item_variant_id + warehouse_id
        $pairs = collect($data)
            ->filter(function ($item) use ($totalIdChanges, $idChanges) {
                if ($totalIdChanges > 0 && ! isset($idChanges[$item['id']])) {
                    return false;
                }

                return isset($item['item'], $item['source_warehouse']);
            })
            ->map(fn ($item) => [
                'item_variant_id' => $item['item']['id'],
                'warehouse_id'    => $item['source_warehouse']['id'],
            ])
            ->unique()
            ->values();

        // 2. Query sekali
        $stocks = Stock::whereIn('item_variant_id', $pairs->pluck('item_variant_id'))
            ->whereIn('warehouse_id', $pairs->pluck('warehouse_id'))
            ->get()
            ->keyBy(fn ($s) => "{$s->item_variant_id}-{$s->warehouse_id}");

        // 3. Susun result
        foreach ($data as $item) {
            if ($totalIdChanges > 0 && ! isset($idChanges[$item['id']])) {
                continue;
            }

            if (! isset($item['item'], $item['source_warehouse'])) {
                $result[$item['id']] = [];

                continue;
            }

            $key = $item['item']['id'] . '-' . $item['source_warehouse']['id'];

            $result[$item['id']] = [
                'available_stock' => $stocks[$key]->actual_quantity ?? 0,
            ];
        }

        return response()->json($result);
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
            'stocks'      => Inertia::defer(function () use ($itemVariant) {
                $warehouses = Warehouse::with(['stocks' => fn ($query) => $query->where('item_variant_id', $itemVariant->id), 'stocks.unit', 'branch']);
                if (Session::has('currentBranch')) {
                    $branch = Branch::find(Session::get('currentBranch'));
                    if (! $branch->is_main_branch) {
                        $warehouses->where('warehouses.branch_id', $branch->id);
                    }
                }
                $warehouses = $warehouses->get()
                    ->map(fn ($warehouse) => [
                        ...$warehouse->toArray(),
                        'actual_stock'   => $warehouse->stocks->sum('quantity'),
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

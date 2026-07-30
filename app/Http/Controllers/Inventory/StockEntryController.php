<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StockEntryRequest;
use App\Models\Inventory\StockEntry;
use App\Models\Service\WorkOrder;
use App\Services\Inventory\StockEntryService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class StockEntryController extends Controller {
    private StockEntryService $service;

    public function __construct(Request $request, StockEntryService $service) {
        $this->service = $service;
        parent::__construct($request, StockEntry::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        StockEntry::dataTable($request);

        return Inertia::render('Inventory/StockEntries/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request, $ref) {
        if ($ref) {
            $select   = $request->has('select') ? $request->select : null;
            $split    = \explode('/', $ref);
            $modelOri = $split[0] ?? null;
            if ($modelOri) {
                switch ($modelOri) {
                    case 'workOrder':
                        $workOrder = WorkOrder::find($split[1]);
                        if ($workOrder) {
                            $defaultData = [
                                'date'               => now(),
                                'referenceable_type' => WorkOrder::class,
                                'referenceable_id'   => $workOrder->id,
                                'referenceable'      => $workOrder,
                                'type'               => 'item_consumption',
                                'branch_id'          => $workOrder->branch_id,
                                'items'              => $workOrder->items->map(fn ($item) => [
                                    'id'   => Utils::generateRandom(5),
                                    'item' => $item->item,
                                ]),
                            ];
                        }
                        break;

                }
            }
        }
        $this->setBreadcrumbs('inventory.stockEntry.new');

        return Inertia::render('Inventory/StockEntries/Show', [
            'defaultData' => $defaultData ?? null,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StockEntryRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $stockEntry = $this->service->create($data);
        DB::commit();

        return redirect()->route('stockEntries.show', $stockEntry)->with('id', $stockEntry->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(StockEntry $stockEntry) {
        $this->setBreadcrumbs($stockEntry);
        $stockEntry->showDetail();

        return Inertia::render('Inventory/StockEntries/Show', [
            'stockEntry' => function () use ($stockEntry) {
                $stockEntry->loadRelations();

                return $stockEntry;
            },
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id) {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(StockEntryRequest $request, StockEntry $stockEntry) {
        $data = $request->validated();
        DB::beginTransaction();
        $stockEntry = $this->service->update($stockEntry, $data);
        DB::commit();

        return redirect()->route('stockEntries.show', $stockEntry);
    }

    public function submit(StockEntry $stockEntry) {
        $this->service->submit($stockEntry);

        return back();
    }

    public function onApproved(StockEntry $stockEntry) {
        $this->service->onApproved($stockEntry);

        return back();
    }

    public function onRejected(StockEntry $stockEntry) {
        $this->service->onRejected($stockEntry);

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(StockEntry $stockEntry) {
        DB::beginTransaction();
        try {
            $stockEntry->delete();
            $stockEntry->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('stockEntries.index');
    }
}

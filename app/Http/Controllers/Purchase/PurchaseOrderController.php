<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseOrderRequest;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\Service\WorkOrder;
use App\Models\Service\WorkOrderItem;
use App\Services\Purchase\PurchaseOrderService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PurchaseOrderController extends Controller {
    public function __construct(Request $request, PurchaseOrderService $service) {
        $this->service = $service;
        parent::__construct($request, PurchaseOrder::class);
    }

    protected function enforcePermission(string $method): ?string {
        return match ($method) {
            'markDone', 'syncItems' => 'write',
            default                 => null,
        };
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        PurchaseOrder::dataTable($request);

        return Inertia::render('Purchase/PurchaseOrders/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request, $ref = null) {
        if ($ref) {
            $split    = \explode('/', $ref);
            $modelOri = $split[0] ?? null;
            if ($modelOri) {
                switch ($modelOri) {
                    case 'workOrder':
                        $wo = WorkOrder::find($split[1]);
                        if ($wo) {
                            $wo->loadRelations();
                            $defaultData = [
                                'items' => $wo->items->map(fn ($item) => [
                                    ...$item,
                                    'id'                 => Utils::generateRandom(5),
                                    'quantity'           => $item->required_quantity,
                                    'unit'               => $item->unit,
                                    'referenceable_type' => WorkOrderItem::class,
                                    'referenceable_id'   => $item->id,
                                ]),
                            ];
                        }
                        break;

                    case 'purchaseRequest':
                        $pr = PurchaseRequest::find($split[1]);
                        if ($pr) {
                            $pr->loadRelations();
                            $defaultData = [
                                'required_date' => $pr->required_date,
                                'items'         => $pr->items->map(function ($item) {
                                    return [
                                        ...$item->toArray(),
                                        'id'                 => Utils::generateRandom(5),
                                        'quantity'           => $item->unordered_quantity,
                                        'required_date'      => $item->required_date,
                                        'unit'               => $item->unit,
                                        'referenceable_type' => PurchaseRequestItem::class,
                                        'referenceable_id'   => $item->id,
                                    ];
                                }),
                            ];
                        }
                        break;

                }
            }
        }
        $this->setBreadcrumbs('purchase.purchaseOrder.new');

        return Inertia::render('Purchase/PurchaseOrders/Show', [
            'defaultData' => $defaultData ?? null,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(PurchaseOrderRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();

        // branch dari session
        $data['branch_id']     = $request->session()->get('currentBranch');
        $data['created_by_id'] = $request->user()->id;

        // create PO
        $po = $this->service->create($data);

        DB::commit();

        return redirect()->route('purchaseOrders.show', $po)->with('id', $po->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(PurchaseOrder $purchaseOrder) {
        $this->setBreadcrumbs($purchaseOrder);
        $purchaseOrder->showDetail();

        return Inertia::render('Purchase/PurchaseOrders/Show', [
            'purchaseOrder' => function () use ($purchaseOrder) {
                $purchaseOrder->loadRelations();

                return $purchaseOrder;
            },
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(PurchaseOrderRequest $request, PurchaseOrder $purchaseOrder) {
        $data = $request->validated();
        DB::beginTransaction();

        $po = $this->service->update($purchaseOrder, $data);

        DB::commit();

        return redirect()->back();
    }

    /**
     * Submit Purchase Order.
     */
    public function submit(Request $request, PurchaseOrder $purchaseOrder) {
        $po = $this->service->submit($purchaseOrder);

        return redirect()->back();
    }

    public function onApproved(PurchaseOrder $purchaseOrder) {
        $this->service->onApproved($purchaseOrder);

        return back();
    }

    public function onRejected(PurchaseOrder $purchaseOrder) {
        $this->service->onRejected($purchaseOrder);

        return back();
    }

    /**
     * Sync PO items berdasarkan data Invoice & Receipt (split per rate/tax/warehouse).
     */
    public function syncItems(PurchaseOrder $purchaseOrder) {
        $syncLog = $this->service->syncItems($purchaseOrder);

        return back()->with('success', 'Items berhasil disinkronisasi.');
    }

    /**
     * Validasi receipt == invoice qty, lalu finalisasi PO sebagai COMPLETED.
     */
    public function markDone(PurchaseOrder $purchaseOrder) {
        try {
            $result = $this->service->markDone($purchaseOrder);

            return back()->with('success', 'Purchase Order telah selesai.');
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PurchaseOrder $purchaseOrder) {
        DB::beginTransaction();
        try {
            $purchaseOrder->delete();
            $purchaseOrder->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('purchaseOrders.index');
    }
}

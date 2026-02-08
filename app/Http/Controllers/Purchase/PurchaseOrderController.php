<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseOrderRequest;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Service\WorkOrder;
use App\Services\Purchase\PurchaseOrderService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseOrderController extends Controller
{
    private PurchaseOrderService $service;

    public function __construct(Request $request, PurchaseOrderService $service)
    {
        $this->service = $service;
        parent::__construct($request, PurchaseOrder::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->setBreadcrumbs();
        PurchaseOrder::dataTable($request);

        return Inertia::render('Purchase/PurchaseOrders/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request, $ref = null)
    {
        if ($ref) {
            $split = \explode('/', $ref);
            $modelOri = $split[0] ?? null;
            if ($modelOri) {
                switch ($modelOri) {
                    case 'workOrder':
                        $wo = WorkOrder::find($split[1]);
                        if ($wo) {
                            $po = PurchaseOrder::where('referenceable_type', WorkOrder::class)
                                ->where('referenceable_id', $wo->id)
                                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                                ->where('created_by', $request->user()->id)
                                ->first();
                            if ($po) {
                                return redirect()->route('purchaseOrders.show', $po);
                            }
                            $defaultData = [
                                'date' => now(),
                                'items' => $wo->items->map(fn ($item) => [
                                    ...$item,
                                    'id' => Utils::generateRandom(5), 'quantity' => $item->remaining_quantity,
                                    'unit' => $item->unit,
                                    'referenceable' => $item,
                                ]),
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
    public function store(PurchaseOrderRequest $request)
    {
        dd($request->all());
        $data = $request->validated();
        DB::beginTransaction();

        // branch dari session
        $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();

        // generate code
        $code = FormatingSeries::get(PurchaseOrder::class, $data);
        $data['code'] = $code;
        $data['created_by'] = $request->user()->id;

        // create PO
        $po = $this->service->create($data);

        DB::commit();

        return redirect()->route('purchaseOrders.show', $po);
    }

    /**
     * Display the specified resource.
     */
    public function show(PurchaseOrder $purchaseOrder)
    {
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
    public function update(PurchaseOrderRequest $request, PurchaseOrder $purchaseOrder)
    {
        $data = $request->validated();
        DB::beginTransaction();

        $po = $this->service->update($purchaseOrder, $data);

        DB::commit();

        return redirect()->back();
    }

    /**
     * Submit Purchase Order.
     */
    public function submit(Request $request, PurchaseOrder $purchaseOrder)
    {
        $po = $this->service->submit($purchaseOrder);

        return redirect()->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PurchaseOrder $purchaseOrder)
    {
        DB::beginTransaction();
        $purchaseOrder->delete();
        $purchaseOrder->logForDeleted();
        DB::commit();

        return redirect()->back();
    }
}

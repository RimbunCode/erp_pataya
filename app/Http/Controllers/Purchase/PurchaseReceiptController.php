<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseReceiptRequest;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Purchase\PurchaseReceiptService;
use App\Utils;
use DB;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PurchaseReceiptController extends Controller
{
    private PurchaseReceiptService $service;

    public function __construct(Request $request, PurchaseReceiptService $service)
    {
        $this->service = $service;
        parent::__construct($request, PurchaseReceipt::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->setBreadcrumbs();
        PurchaseReceipt::dataTable($request);

        return Inertia::render('Purchase/PurchaseReceipts/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request, ?string $ref = null)
    {
        if ($ref) {
            $split = \explode('/', $ref);
            $modelOri = $split[0] ?? null;
            if ($modelOri) {
                switch ($modelOri) {
                    case 'purchaseOrder':
                        $purchaseOrder = PurchaseOrder::find($split[1]);
                        if ($purchaseOrder) {
                            $purchaseReceipt = PurchaseReceipt::where('purchase_order_id', $purchaseOrder->id)
                                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                                ->where('created_by', $request->user()->id)
                                ->first();
                            if ($purchaseReceipt) {
                                return redirect()->route('purchaseReceipts.show', $purchaseReceipt);
                            }
                            $purchaseOrder->loadRelations();

                            $defaultData = [
                                'received_date' => now(),
                                'purchase_order' => $purchaseOrder,
                                'supplier' => $purchaseOrder->supplier,
                                'items' => $purchaseOrder->items->map(function ($item) {
                                    return [
                                        'id' => Utils::generateRandom(5),
                                        'purchase_order_item_id' => $item->id,
                                        'item' => $item->item,
                                        'description' => $item->description,
                                        'quantity' => $item->quantity,
                                        'unit' => $item->unit,
                                        'target_warehouse' => $item->targetWarehouse,
                                    ];
                                }),

                            ];
                        }
                        break;

                    case 'purchaseReceipt':
                        $purchaseReceiptTarget = PurchaseReceipt::find($split[1]);
                        if ($purchaseReceiptTarget) {
                            $purchaseReceipt = PurchaseReceipt::where('return_against_id', $purchaseReceiptTarget->id)
                                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                                ->where('created_by', $request->user()->id)
                                ->first();
                            if ($purchaseReceipt) {
                                return redirect()->route('purchaseReceipts.show', $purchaseReceipt);
                            }

                            $purchaseReceiptTarget->loadRelations();
                            $defaultData = [
                                'return_against' => $purchaseReceiptTarget,
                                'received_date' => now(),
                                'purchase_order' => $purchaseReceiptTarget->purchaseOrder,
                                'supplier' => $purchaseReceiptTarget->supplier,
                                'items' => $purchaseReceiptTarget->items->map(function ($item) {
                                    return [
                                        'id' => Utils::generateRandom(5),
                                        'return_against_item_id' => $item->id,
                                        'purchase_order_item_id' => $item->purchase_order_item_id,
                                        'item' => $item->item,
                                        'description' => $item->description,
                                        'quantity' => $item->quantity,
                                        'unit' => $item->unit,
                                        'target_warehouse' => $item->targetWarehouse,
                                    ];
                                }),

                            ];
                        }
                        break;

                }
            }
        }

        $this->setBreadcrumbs('purchase.purchaseReceipt.new');

        return Inertia::render('Purchase/PurchaseReceipts/Show', [
            'defaultData' => $defaultData ?? [],
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(PurchaseReceiptRequest $request)
    {
        $data = $request->validated();
        DB::beginTransaction();

        $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();

        // generate code
        $code = FormatingSeries::get(PurchaseReceipt::class, $data);
        $data['code'] = $code;
        $data['created_by'] = $request->user()->id;

        $purchaseReceipt = $this->service->create($data);
        $purchaseReceipt->logForCreated();

        DB::commit();

        return redirect()->route('purchaseReceipts.show', $purchaseReceipt);
    }

    /**
     * Display the specified resource.
     */
    public function show(PurchaseReceipt $purchaseReceipt)
    {
        $this->setBreadcrumbs($purchaseReceipt);
        $purchaseReceipt->showDetail();

        return Inertia::render('Purchase/PurchaseReceipts/Show', [
            'purchaseReceipt' => function () use ($purchaseReceipt) {
                $purchaseReceipt->loadRelations();

                return $purchaseReceipt;
            },
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(PurchaseReceiptRequest $request, PurchaseReceipt $purchaseReceipt)
    {
        $data = $request->validated();
        DB::beginTransaction();

        $this->service->update($purchaseReceipt, $data);

        DB::commit();

        return redirect()->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PurchaseReceipt $purchaseReceipt)
    {
        DB::beginTransaction();

        $purchaseReceipt->delete();
        $purchaseReceipt->logForDeleted();

        DB::commit();

        return redirect()->route('purchaseReceipts.index');
    }

    public function submit(PurchaseReceipt $purchaseReceipt)
    {
        $this->service->submit($purchaseReceipt);

        return redirect()->back();
    }

    public function onApproved(PurchaseReceipt $purchaseReceipt)
    {
        $this->service->onApproved($purchaseReceipt);

        return redirect()->back();
    }

    public function onRejected(PurchaseReceipt $purchaseReceipt)
    {
        $this->service->onRejected($purchaseReceipt);

        return redirect()->back();
    }

    public function cancel(PurchaseReceipt $purchaseReceipt)
    {
        $this->service->cancel($purchaseReceipt);

        return redirect()->back();
    }
}

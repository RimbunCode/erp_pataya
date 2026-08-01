<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseRequestRequest;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Service\WorkOrder;
use App\Models\Service\WorkOrderItem;
use App\Services\Purchase\PurchaseRequestService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseRequestController extends Controller {
    public function __construct(Request $request, PurchaseRequestService $service) {
        $this->service = $service;
        parent::__construct($request, PurchaseRequest::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        PurchaseRequest::dataTable($request);

        return Inertia::render('Purchase/PurchaseRequests/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request, ?string $ref = null) {
        if ($ref) {
            $select   = $request->has('select') ? $request->select : null;
            $split    = \explode('/', $ref);
            $modelOri = $split[0] ?? null;
            if ($modelOri) {
                switch ($modelOri) {
                    case 'workOrder':
                        $wo = WorkOrder::find($split[1]);
                        if ($wo) {
                            $wo->loadRelations();
                            $defaultData = [
                                'date'  => now(),
                                'items' => $wo->items->filter(fn ($item) => $item->item->is_stock_item)
                                    ->map(fn ($item) => [
                                        'id'                 => Utils::generateRandom(5),
                                        'item'               => $item->item,
                                        'description'        => $item->description,
                                        'quantity'           => $item->required_quantity,
                                        'unit'               => $item->unit,
                                        'referenceable'      => $item,
                                        'referenceable_type' => WorkOrderItem::class,
                                        'referenceable_id'   => $item->id,
                                    ]),
                            ];
                        }
                        break;

                }
            }
        }

        $this->setBreadcrumbs('purchase.purchaseRequest.new');

        return Inertia::render('Purchase/PurchaseRequests/Show', [
            'defaultData' => $defaultData ?? null,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(PurchaseRequestRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['branch_id'] = $request->session()->get('currentBranch');

        $wo = $this->service->create($data);
        DB::commit();

        return redirect()->route('purchaseRequests.show', $wo)->with('id', $wo->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, PurchaseRequest $purchaseRequest) {
        $this->setBreadcrumbs($purchaseRequest);
        $purchaseRequest->showDetail();

        return Inertia::render('Purchase/PurchaseRequests/Show', [
            'purchaseRequest' => function () use ($purchaseRequest) {
                $purchaseRequest->loadRelations();

                return $purchaseRequest;
            },
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(PurchaseRequestRequest $request, PurchaseRequest $purchaseRequest) {
        $data = $request->validated();
        DB::beginTransaction();
        $this->service->update($purchaseRequest, $data);
        DB::commit();

        return back();
    }

    public function submit(PurchaseRequest $purchaseRequest) {
        $this->service->submit($purchaseRequest);

        return back();
    }

    public function onApproved(PurchaseRequest $purchaseRequest) {
        $this->service->onApproved($purchaseRequest);

        return back();
    }

    public function onRejected(PurchaseRequest $purchaseRequest) {
        $this->service->onRejected($purchaseRequest);

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PurchaseRequest $purchaseRequest) {
        DB::beginTransaction();
        try {
            $purchaseRequest->delete();
            $purchaseRequest->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('purchaseRequests.index');
    }
}

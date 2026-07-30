<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\SalesOrderRequest;
use App\Models\Core\Branch;
use App\Models\Sales\SalesOrder;
use App\Models\Service\WorkOrder;
use App\Services\Sales\SalesOrderService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SalesOrderController extends Controller {
    private SalesOrderService $service;

    public function __construct(Request $request, SalesOrderService $service) {
        $this->service = $service;
        parent::__construct($request, SalesOrder::class);
    }

    protected function enforcePermission(string $method): ?string {
        return match ($method) {
            'markDone', 'syncItems' => 'write',
            default => null,
        };
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        SalesOrder::dataTable($request);

        return Inertia::render('Sales/SalesOrders/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request, ?string $ref = null) {
        if ($ref) {
            $split    = \explode('/', $ref);
            $modelOri = $split[0] ?? null;
            if ($modelOri) {
                switch ($modelOri) {
                    case 'workOrder':
                        $wo = WorkOrder::find($split[1]);
                        if ($wo) {
                            $so = SalesOrder::where('referenceable_type', WorkOrder::class)
                                ->where('referenceable_id', $wo->id)
                                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                                ->where('created_by_id', $request->user()->id)
                                ->first();
                            if ($so) {
                                return redirect()->route('salesOrders.show', $so);
                            }
                            $defaultData = [
                                'date'               => now(),
                                'customer'           => $wo->customer,
                                'customer_branch'    => $wo->customerBranch,
                                'referenceable_type' => WorkOrder::class,
                                'referenceable_id'   => $wo->id,
                                'referenceable'      => $wo,
                                'external_note'      => $wo->external_note,
                                'items'              => $wo->items->map(fn ($item) => [
                                    'id'       => Utils::generateRandom(5),
                                    'item'     => $item->item,
                                    'quantity' => $item->remaining_quantity,
                                    'unit'     => $item->unit,
                                ]),
                            ];
                        }
                        break;

                }
            }
        }

        $this->setBreadcrumbs('sales.salesOrder.new');

        return Inertia::render('Sales/SalesOrders/Show', [
            'defaultData' => $defaultData ?? null,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(SalesOrderRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();

        // branch dari session
        $data['branch_id']     = $request->session()->get('currentBranch');
        $data['created_by_id'] = $request->user()->id;

        // create SO
        $so = $this->service->create($data);
        $so->logForCreated();

        DB::commit();

        return redirect()->route('salesOrders.show', $so)->with('id', $so->id);
    }

    /**
     * Display the specified resource
     */
    public function show(SalesOrder $salesOrder) {
        $this->setBreadcrumbs($salesOrder);
        $salesOrder->showDetail();

        return Inertia::render('Sales/SalesOrders/Show', [
            'salesOrder' => function () use ($salesOrder) {
                $salesOrder->loadRelations();

                return $salesOrder;
            },
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(SalesOrderRequest $request, SalesOrder $salesOrder) {
        $data = $request->validated();
        DB::beginTransaction();

        $so = $this->service->update($salesOrder, $data);

        DB::commit();

        return redirect()->back();
    }

    /**
     * Submit Sales Order.
     */
    public function submit(Request $request, SalesOrder $salesOrder) {
        $so = $this->service->submit($salesOrder);

        return redirect()->back();
    }

    public function onApproved(SalesOrder $salesOrder) {
        $this->service->onApproved($salesOrder);

        return back();
    }

    public function onRejected(SalesOrder $salesOrder) {
        $this->service->onRejected($salesOrder);

        return back();
    }

    public function cancel(SalesOrder $salesOrder) {
        $this->service->cancel($salesOrder);

        return back();
    }

    public function syncItems(SalesOrder $salesOrder) {
        $this->service->syncItems($salesOrder);

        return redirect()->back()->with('success', true);
    }

    public function markDone(SalesOrder $salesOrder) {
        $this->service->markDone($salesOrder);

        return redirect()->back()->with('success', true);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(SalesOrder $salesOrder) {
        DB::beginTransaction();
        try {
            $salesOrder->delete();
            $salesOrder->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('salesOrders.index');
    }
}

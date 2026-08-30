<?php

namespace App\Http\Controllers\Sales;

use App\Enums\AssetOwnershipType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\SalesOrderRequest;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Core\Branch;
use App\Models\CRM\Quotation;
use App\Models\Sales\SalesOrder;
use App\Models\Service\WorkOrder;
use App\Services\Sales\SalesOrderService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SalesOrderController extends Controller {
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

                    case 'quotation':
                        $quotation = Quotation::find($split[1]);
                        if ($quotation) {
                            $so = SalesOrder::where('referenceable_type', Quotation::class)
                                ->where('referenceable_id', $quotation->id)
                                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                                ->where('created_by_id', $request->user()->id)
                                ->first();
                            if ($so) {
                                return redirect()->route('salesOrders.show', $so);
                            }
                            $quotation->loadRelations();
                            $defaultData = [
                                'date'               => now(),
                                'customer'           => $quotation->customer,
                                'referenceable_type' => Quotation::class,
                                'referenceable_id'   => $quotation->id,
                                'referenceable'      => $quotation,
                                // unit & tax sengaja dikosongkan — diisi manual sebelum submit SO,
                                // karena QuotationItem tidak menyimpan field ini (item sederhana).
                                'items' => $quotation->items->map(fn ($item) => [
                                    'id'          => Utils::generateRandom(5),
                                    'item'        => $item->item,
                                    'description' => $item->description,
                                    'quantity'    => $item->quantity,
                                    'price'       => $item->price,
                                ]),
                            ];
                        }
                        break;

                    case 'assetService':
                        $svc = AssetService::find($split[1]);
                        if ($svc) {
                            $svc->loadRelations();
                            // Requirement 7.1-7.4, spec asset-service-billing-reference-flow:
                            // di controller (native Eloquent::load()), batasan kedalaman
                            // `with` 2-segmen milik endpoint /model TIDAK berlaku — jadi
                            // path ownership_customer bisa dimuat penuh walau lewat chain
                            // assetMaintenanceTask.assetMaintenance.asset.
                            $svc->load([
                                'asset.ownershipCustomer',
                                'asset.ownershipCustomerBranch',
                                'assetMaintenanceTask.assetMaintenance.asset.ownershipCustomer',
                                'assetMaintenanceTask.assetMaintenance.asset.ownershipCustomerBranch',
                            ]);
                            $resolvedAsset   = $svc->resolvedAsset();
                            $billingCustomer = null;
                            if ($svc->bill_to_renter) {
                                $billingCustomer = [$svc->customer, $svc->customerBranch];
                            } elseif ($resolvedAsset?->ownership_type === AssetOwnershipType::CUSTOMER) {
                                $billingCustomer = [$resolvedAsset->ownershipCustomer, $resolvedAsset->ownershipCustomerBranch];
                            }
                            $defaultData = [
                                'date'               => now(),
                                'referenceable_type' => AssetService::class,
                                'referenceable_id'   => $svc->id,
                                'referenceable'      => $svc,
                                'customer'           => $billingCustomer[0] ?? null,
                                'customer_branch'    => $billingCustomer[1] ?? null,
                                'items'              => $svc->consumedItems->map(fn ($item) => [
                                    'id'                 => Utils::generateRandom(5),
                                    'item'               => $item->item,
                                    'quantity'           => $item->quantity,
                                    'unit'               => $item->itemUnit,
                                    'price'              => $item->valuation_rate,
                                    'referenceable'      => $item,
                                    'referenceable_type' => AssetServiceConsumedItem::class,
                                    'referenceable_id'   => $item->id,
                                    'assetServiceLocked' => true,
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

    public function syncItems(SalesOrder $salesOrder) {
        $this->service->syncItems($salesOrder);

        return redirect()->back()->with('success', true);
    }

    public function markDone(SalesOrder $salesOrder) {
        $this->service->markDone($salesOrder);

        return redirect()->back()->with('success', true);
    }
}

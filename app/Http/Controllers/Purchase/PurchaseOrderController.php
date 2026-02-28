<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseOrderRequest;
use App\Models\Core\Branch;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Service\WorkOrder;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\Service\WorkOrderItem;
use App\Services\Purchase\PurchaseOrderService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseOrderController extends Controller {
  private PurchaseOrderService $service;

  public function __construct(Request $request, PurchaseOrderService $service) {
    $this->service = $service;
    parent::__construct($request, PurchaseOrder::class);
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
      $split    = \explode("/", $ref);
      $modelOri = $split[0] ?? null;
      if ($modelOri) {
        switch ($modelOri) {
          case 'workOrder': {
            $wo = WorkOrder::find($split[1]);
            if ($wo) {
              $wo->loadRelations();
              $defaultData = [
                'items' => $wo->items->map(fn ($item) => [
                  ...$item,
                  'id'                 => Utils::generateRandom(5),
                  'quantity'           => $item->remaining_quantity,
                  'unit'               => $item->unit,
                  'referenceable_type' => WorkOrderItem::class,
                  'referenceable_id'   => $item->id,
                ]),
              ];
            }
            break;
          }
          case 'purchaseRequest': {
            $pr = PurchaseRequest::find($split[1]);
            if ($pr) {
              $pr->loadRelations();
              $defaultData = [
                'required_date' => $pr->required_date,
                'items'         => $pr->items->map(function ($item) {
                  return [
                    ...$item->toArray(),
                    'id'                 => Utils::generateRandom(5),
                    'quantity'           => $item->remaining_quantity,
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
    $data['branch']     = Branch::find($request->session()->get('currentBranch'))->toArray();
    $data['created_by'] = $request->user()->id;

    // create PO
    $po = $this->service->create($data);

    DB::commit();
    return redirect()->route('purchaseOrders.show', $po);
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

  public function cancel(PurchaseOrder $purchaseOrder) {
    $this->service->cancel($purchaseOrder);
    return back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(PurchaseOrder $purchaseOrder) {
    DB::beginTransaction();
    $purchaseOrder->delete();
    $purchaseOrder->logForDeleted();
    DB::commit();
    return redirect()->route('purchaseOrders.index');
  }
}

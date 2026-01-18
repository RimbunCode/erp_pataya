<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseOrderRequest;
use App\Models\Core\Branch;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Service\WorkOrder;
use App\Services\Core\FormatingSeriesService;
use App\Services\Purchase\PurchaseOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseOrderController extends Controller {
  private FormatingSeriesService $referenceCodeService;
  private PurchaseOrderService   $service;

  public function __construct(Request $request, FormatingSeriesService $referenceCodeService, PurchaseOrderService $service) {
    $this->referenceCodeService = $referenceCodeService;
    $this->service              = $service;
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
      $select   = $request->has('select') ? $request->select : null;
      $split    = \explode("/", $ref);
      $modelOri = $split[0] ?? null;
      if ($modelOri) {
        $model = match ($modelOri) {
          'workOrder'       => WorkOrder::class,
          'purchaseRequest' => PurchaseRequest::class,
          default           => null,
        };
        if ($select == null) {
          $select = match ($modelOri) {
            'workOrder'       => "items",
            'purchaseRequest' => "items",
            default           => null,
          };
        }
      }
      $id = $split[1] ?? null;

      if ($model == PurchaseRequest::class) {
        $data = PurchaseRequest::find($id);
      }
    }
    $this->setBreadcrumbs('purchase.purchaseOrder.new');
    return Inertia::render('Purchase/PurchaseOrders/Show', [
      'loadFrom'      => isset($model) && $id ? [
        'model'  => $model,
        'id'     => $id,
        'select' => $select,
      ] : null,
      'required_date' => $data?->required_date ?? null,
    ]);
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(PurchaseOrderRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();

    // branch dari session
    $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();

    // generate code
    $code               = $this->referenceCodeService->get(PurchaseOrder::class, $data);
    $data['code']       = $code;
    $data['created_by'] = $request->user()->id;

    // create PO
    $po = $this->service->create($data);
    $po->logForCreated();

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

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(PurchaseOrder $purchaseOrder) {
    DB::beginTransaction();
    $purchaseOrder->delete();
    $purchaseOrder->logForDeleted();
    DB::commit();
    return redirect()->back();
  }
}

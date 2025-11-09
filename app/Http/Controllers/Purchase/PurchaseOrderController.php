<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Service\WorkOrder;
use App\Services\Core\FormatingSeriesService;
use App\Services\Purchase\PurchaseOrderService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PurchaseOrderController extends Controller {
  private FormatingSeriesService $referenceCodeService;
  private PurchaseOrderService $service;

  public function __construct(Request $request, FormatingSeriesService $referenceCodeService, PurchaseOrderService $service) {
    $this->referenceCodeService = $referenceCodeService;
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
  public function create(Request $request, $ref) {
    if ($ref) {
      $select = $request->has('select') ? $request->select : null;
      $split = \explode("/", $ref);
      $modelOri = $split[0] ?? null;
      if ($modelOri) {
        $model = match ($modelOri) {
          'workOrder' => WorkOrder::class,
          'purchaseRequest' => PurchaseRequest::class,
          default => null,
        };
        if ($select == null) {
          $select = match ($modelOri) {
            'workOrder' => "items",
            'purchaseRequest' => "items",
            default => null,
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
      'loadFrom' => isset($model) && $id ? [
        'model' => $model,
        'id' => $id,
        'select' => $select,
      ] : null,
      'required_date' => $data?->required_date ?? null,
    ]);
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(Request $request) {
  }

  /**
   * Display the specified resource.
   */
  public function show(PurchaseOrder $purchaseOrder) {
    $this->setBreadcrumbs();
    $purchaseOrder->showDetail();
    return Inertia::render('Purchase/PurchaseOrders/Show');
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
  public function update(Request $request, string $id) {
    //
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(string $id) {
    //
  }
}

<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseReceiptRequest;
use App\Models\Core\Branch;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Core\FormatingSeriesService;
use App\Services\Purchase\PurchaseReceiptService;
use App\Utils;
use DB;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PurchaseReceiptController extends Controller {
  private FormatingSeriesService $referenceCodeService;
  private PurchaseReceiptService $service;

  public function __construct(Request $request, FormatingSeriesService $referenceCodeService, PurchaseReceiptService $service) {
    $this->referenceCodeService = $referenceCodeService;
    $this->service              = $service;
    parent::__construct($request, PurchaseReceipt::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    PurchaseReceipt::dataTable($request);

    return Inertia::render('Purchase/PurchaseReceipts/Index');
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create(Request $request, string $ref = null) {
    $purchaseOrder = PurchaseOrder::with(
      "items",
      "supplier",
      "items.item",
      "items.unit",
      "items.targetWarehouse",
    )
      ->find($ref);
    $this->setBreadcrumbs('purchase.purchaseReceipt.new');
    return Inertia::render('Purchase/PurchaseReceipt/Show', [
      'defaultData' => [
        'received_date'  => now(),
        'purchase_order' => $purchaseOrder,
        'supplier'       => $purchaseOrder->supplier,
        'items'          => $purchaseOrder->items->map(function ($item) {
          return [
            'id'                     => Utils::generateRandom(5),
            'purchase_order_item_id' => $item->id,
            'item'                   => $item->item,
            'description'            => $item->description,
            'quantity'               => $item->quantity,
            'unit'                   => $item->unit,
            'target_warehouse'       => $item->targetWarehouse,
          ];
        }),

      ],
    ]);
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(PurchaseReceiptRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();

    $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();

    // generate code
    $code               = $this->referenceCodeService->get(PurchaseReceipt::class, $data);
    $data['code']       = $code;
    $data['created_by'] = $request->user()->id;

    $purchaseReceipt = $this->service->create($data);
    $purchaseReceipt->logForCreated();

    DB::commit();
    return redirect()->route('purchaseReceipts.show', $purchaseReceipt);
  }

  /**
   * Display the specified resource.
   */
  public function show(PurchaseReceipt $purchaseReceipt) {
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

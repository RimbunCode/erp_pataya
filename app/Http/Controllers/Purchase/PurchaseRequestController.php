<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseRequestRequest;
use App\Models\Core\Branch;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Service\WorkOrder;
use App\Models\Service\WorkOrderItem;
use App\Models\Core\FormatingSeries;
use App\Services\Purchase\PurchaseRequestService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseRequestController extends Controller {
  private PurchaseRequestService $service;

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
      $split    = \explode("/", $ref);
      $modelOri = $split[0] ?? null;
      if ($modelOri) {
        switch ($modelOri) {
          case 'workOrder': {
            $wo = WorkOrder::find($split[1]);
            if ($wo) {
              $defaultData = [
                'date'  => now(),
                'items' => $wo->items->map(fn ($item) => [
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
      $id = $split[1] ?? null;
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
    $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();
    $code           = FormatingSeries::generate(PurchaseRequest::class, $data);
    $data['code']   = $code;

    $wo = $this->service->create($data);
    DB::commit();
    return redirect()->route('purchaseRequests.show', $wo);
  }

  /**
   * Display the specified resource.
   */
  public function show(PurchaseRequest $purchaseRequest) {
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

  public function cancel(PurchaseRequest $purchaseRequest) {
    $this->service->cancel($purchaseRequest);
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
    $purchaseRequest->delete();
    DB::commit();
    return back();
  }
}

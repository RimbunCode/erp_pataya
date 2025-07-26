<?php

namespace App\Http\Controllers\Service;

use App\Http\Controllers\Controller;
use App\Http\Requests\Service\WorkOrderRequest;
use App\Models\Core\Branch;
use App\Models\Service\WorkOrder;
use App\Services\Core\FormatingSeriesService;
use App\Services\Service\WorkOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class WorkOrderController extends Controller {
  private FormatingSeriesService $referenceCodeService;
  private WorkOrderService $service;
  public function __construct(Request $request, FormatingSeriesService $preferenceCodeService, WorkOrderService $service) {
    $this->referenceCodeService = $preferenceCodeService;
    $this->service = $service;
    parent::__construct($request, WorkOrder::class);
  }


  /**A
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    WorkOrder::dataTable($request);
    return Inertia::render('Services/WorkOrders/Index');
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create() {
    //
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(WorkOrderRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();
    $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();
    $code = $this->referenceCodeService->get(WorkOrder::class, $data);
    $data['code'] = $code;
    $data['created_by'] = $request->user()->id;

    $wo = $this->service->create($data);
    $wo->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user created this',
        'id' => ':user telah membuat ini',
      ]
    ]);
    DB::commit();
    return redirect()->back();
  }

  /**
   * Display the specified resource.
   */
  public function show(WorkOrder $workOrder) {
    $this->setBreadcrumbs($workOrder);
    $workOrder->showDetail();
    return Inertia::render('Services/WorkOrders/Show', [
      'workOrder' => function () use ($workOrder) {
        $workOrder->load(['items', 'customer', 'customer_branch', 'item_service', 'source_warehouse']);
        return $workOrder;
      },
    ]);
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(WorkOrderRequest $request, WorkOrder $workOrder) {
    $data = $request->validated();
    DB::beginTransaction();
    $wo = $this->service->update($workOrder, $data);
    $wo->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user updated this',
        'id' => ':user memperbarui ini',
      ]
    ]);
    DB::commit();
    return redirect()->back();
  }

  public function submit(Request $request, WorkOrder $workOrder) {
    DB::beginTransaction();
    $wo = $this->service->submit($workOrder);
    $wo->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user updated this',
        'id' => ':user memperbarui ini',
      ]
    ]);
    DB::commit();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(string $id) {
    //
  }
}

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
  private FormatingSeriesService $formatingSeriesService;
  private WorkOrderService $service;
  public function __construct(Request $request, FormatingSeriesService $referenceCodeService, WorkOrderService $service) {
    $this->formatingSeriesService = $referenceCodeService;
    $this->service = $service;
    parent::__construct($request, WorkOrder::class);
  }

  /**A
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    WorkOrder::dataTable($request);
    return Inertia::render(component: 'Services/WorkOrders/Index');
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
    $code = $this->formatingSeriesService->get(WorkOrder::class, $data);
    $data['code'] = $code;

    $wo = $this->service->create($data);
    DB::commit();
    return redirect()->route('workOrders.show', $wo);
  }

  /**
   * Display the specified resource.
   */
  public function show(WorkOrder $workOrder) {
    $this->setBreadcrumbs($workOrder);
    $workOrder->showDetail();
    return Inertia::render('Services/WorkOrders/Show', [
      'workOrder' => function () use ($workOrder) {
        $workOrder->loadRelations();
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

    DB::commit();
    return back();
  }

  public function submit(Request $request, WorkOrder $workOrder) {
    DB::beginTransaction();
    $wo = $this->service->submit($workOrder);
    DB::commit();
    return back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Request $request, WorkOrder $workOrder) {
    //
  }
}

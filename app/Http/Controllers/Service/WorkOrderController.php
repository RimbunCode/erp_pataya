<?php

namespace App\Http\Controllers\Service;

use App\Http\Controllers\Controller;
use App\Http\Requests\Service\WorkOrderRequest;
use App\Models\Service\WorkOrder;
use App\Services\Service\WorkOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class WorkOrderController extends Controller {
    public function __construct(Request $request, WorkOrderService $service) {
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
        $this->setBreadcrumbs();

        return Inertia::render('Services/WorkOrders/Show');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(WorkOrderRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['branch_id'] = $request->session()->get('currentBranch');
        $wo                = $this->service->create($data);
        DB::commit();

        return redirect()->route('workOrders.show', $wo)->with('id', $wo->id);
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
    public function update(WorkOrderRequest $request, WorkOrder $workOrder, mixed $level = null) {
        DB::beginTransaction();
        switch ($level) {
            case 'start':
                $wo = $this->service->start($workOrder);
                break;
            case 'complate':
                $wo = $this->service->complate($workOrder);
                break;
            default:
                $data = $request->validated();
                $wo   = $this->service->update($workOrder, $data);
                break;
        }

        DB::commit();

        return back();
    }

    public function submit(WorkOrder $workOrder) {
        $this->service->submit($workOrder);

        return back();
    }
}

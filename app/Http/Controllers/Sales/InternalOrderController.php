<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\InternalOrderRequest;
use App\Models\Core\Branch;
use App\Models\Sales\InternalOrder;
use App\Services\Sales\InternalOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class InternalOrderController extends Controller {
  private InternalOrderService $service;

  public function __construct(Request $request, InternalOrderService $service) {
    $this->service = $service;
    parent::__construct($request, InternalOrder::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    InternalOrder::dataTable($request);

    return Inertia::render('Sales/InternalOrders/Index');
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
  public function store(InternalOrderRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();

    // branch dari session
    $data['branch_id']     = $request->session()->get('currentBranch');
    $data['created_by_id'] = $request->user()->id;

    // create SO
    $io = $this->service->create($data);

    DB::commit();

    return redirect()->route('internalOrders.show', $io);
  }

  /**
   * Display the specified resource.
   */
  public function show(InternalOrder $internalOrder) {
    $this->setBreadcrumbs($internalOrder);
    $internalOrder->showDetail();

    return Inertia::render('Sales/InternalOrders/Show', [
      'internalOrder' => function () use ($internalOrder) {
        $internalOrder->load(['items', 'items.item', 'items.unit', 'items.sourceWarehouse']);

        return $internalOrder;
      },
    ]);
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(InternalOrderRequest $request, InternalOrder $internalOrder) {
    $data = $request->validated();
    DB::beginTransaction();

    $so = $this->service->update($internalOrder, $data);

    $so->logs()->create([
      'user_id'  => $request->user()->id,
      'activity' => [
        'en' => ':user updated this',
        'id' => ':user memperbarui ini',
      ],
    ]);

    DB::commit();

    return redirect()->back();
  }

  /**
   * Submit Sales Order.
   */
  public function submit(Request $request, InternalOrder $internalOrder) {
    DB::beginTransaction();

    $so = $this->service->submit($internalOrder);

    $so->logs()->create([
      'user_id'  => $request->user()->id,
      'activity' => [
        'en' => ':user submitted this',
        'id' => ':user telah mensubmit ini',
      ],
    ]);

    DB::commit();
  }

  public function onApproved(InternalOrder $internalOrder) {
    $this->service->onApproved($internalOrder);

    return back();
  }

  public function onRejected(InternalOrder $internalOrder) {
    $this->service->onRejected($internalOrder);

    return back();
  }

  public function cancel(InternalOrder $internalOrder) {
    $this->service->cancel($internalOrder);

    return back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(InternalOrder $internalOrder) {
    DB::beginTransaction();
    $internalOrder->delete();
    $internalOrder->logForDeleted();
    DB::commit();

    return redirect()->back();
  }
}

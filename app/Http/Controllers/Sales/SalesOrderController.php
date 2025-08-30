<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\SalesOrderRequest;
use App\Models\Core\Branch;
use App\Models\Sales\SalesOrder;
use App\Services\Core\FormatingSeriesService;
use App\Services\Sales\SalesOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SalesOrderController extends Controller
{
  private FormatingSeriesService $referenceCodeService;
  private SalesOrderService $service;

  public function __construct(Request $request, FormatingSeriesService $preferenceCodeService, SalesOrderService $service)
  {
    $this->referenceCodeService = $preferenceCodeService;
    $this->service = $service;
    parent::__construct($request, SalesOrder::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request)
  {
    $this->setBreadcrumbs();
    SalesOrder::dataTable($request);
    return Inertia::render('Sales/SalesOrders/Index');
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create()
  {
    //
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(SalesOrderRequest $request)
  {
    $data = $request->validated();
    DB::beginTransaction();

    // branch dari session
    $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();

    // generate code
    $code = $this->referenceCodeService->get(SalesOrder::class, $data);
    $data['code'] = $code;
    $data['created_by'] = $request->user()->id;

    // create SO
    $so = $this->service->create($data);

    DB::commit();
    return redirect()->route('salesOrders.show', $so);
  }

  /**
   * Display the specified resource.
   */
  public function show(SalesOrder $salesOrder)
  {
    $this->setBreadcrumbs($salesOrder);
    $salesOrder->showDetail();

    return Inertia::render('Sales/SalesOrders/Show', [
      'salesOrder' => function () use ($salesOrder) {
        $salesOrder->load(['items', 'customer', 'customer_branch', 'currency', 'items.item', 'items.tax', 'items.unit', 'items.sourceWarehouse']);
        return $salesOrder;
      },
    ]);
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(SalesOrderRequest $request, SalesOrder $salesOrder)
  {
    $data = $request->validated();
    DB::beginTransaction();

    $so = $this->service->update($salesOrder, $data);

    $so->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user updated this',
        'id' => ':user memperbarui ini',
      ]
    ]);

    DB::commit();
    return redirect()->back();
  }

  /**
   * Submit Sales Order.
   */
  public function submit(Request $request, SalesOrder $salesOrder)
  {
    DB::beginTransaction();

    $so = $this->service->submit($salesOrder);

    $so->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user submitted this',
        'id' => ':user telah mensubmit ini',
      ]
    ]);

    DB::commit();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(SalesOrder $salesOrder)
  {
    //
  }
}

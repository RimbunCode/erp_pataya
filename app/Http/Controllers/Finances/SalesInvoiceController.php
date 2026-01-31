<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\SalesInvoiceRequest;
use App\Models\Core\Branch;
use App\Models\Finances\SalesInvoice;
use App\Models\Sales\SalesOrder;
use App\Services\Core\FormatingSeriesService;
use App\Services\Finances\SalesInvoiceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SalesInvoiceController extends Controller {
  private FormatingSeriesService $referenceCodeService;
  private SalesInvoiceService    $service;

  public function __construct(Request $request, FormatingSeriesService $preferenceCodeService, SalesInvoiceService $service) {
    $this->referenceCodeService = $preferenceCodeService;
    $this->service              = $service;
    parent::__construct($request, SalesInvoice::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    SalesInvoice::dataTable($request);

    return Inertia::render('Finances/SalesInvoice/Index');
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create(Request $request, string $ref = null) {
    $salesOrder = Salesorder::with(
      "items",
      "customer",
      "customer_branch",
      "currency",
      "items.item",
      "items.tax",
      "items.unit",
      "items.sourceWarehouse",
      "paymentSchedules",
      "paymentSchedules.paymentTerm",
      "paymentSchedules.paymentMethod",
    )
      ->find($ref);
    $this->setBreadcrumbs('finances.salesInvoice.new');
    return Inertia::render('Finances/SalesInvoice/Show', [
      'defaultData' => [
        'date'             => now(),
        'sales_order'      => $salesOrder,
        'customer'         => $salesOrder?->customer,
        'customer_branch'  => $salesOrder?->customer_branch,
        'currency'         => $salesOrder?->currency,
        'items'            => $salesOrder?->items,
        'paymentSchedules' => $salesOrder?->paymentSchedules,
        'amount'           => $salesOrder?->amount,
        'discount_on'      => $salesOrder?->discount_on,
        'discount_rate'    => $salesOrder?->discount_rate,
        'discount_amount'  => $salesOrder?->discount_amount,
        'exchange_rate'    => $salesOrder?->exchange_rate,
        'external_note'    => $salesOrder?->external_note,
      ],
    ]);
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(SalesInvoiceRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();

    // branch dari session
    $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();

    // generate code
    $code               = $this->referenceCodeService->get(SalesInvoice::class, $data);
    $data['code']       = $code;
    $data['created_by'] = $request->user()->id;

    // create SO
    $so = $this->service->create($data);
    $so->logForCreated();

    DB::commit();
    return redirect()->route('salesInvoices.show', $so);
  }

  /**
   * Display the specified resource.
   */
  public function show(SalesInvoice $salesInvoice) {
    $this->setBreadcrumbs($salesInvoice);
    $salesInvoice->showDetail();

    return Inertia::render('Finances/SalesInvoice/Show', [
      'salesInvoice' => function () use ($salesInvoice) {
        $salesInvoice->loadRelations();
        return $salesInvoice;
      },
    ]);
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(SalesInvoiceRequest $request, SalesInvoice $salesInvoice) {
    $data = $request->validated();
    DB::beginTransaction();

    $this->service->update($salesInvoice, $data);

    DB::commit();
    return redirect()->back();
  }

  /**
   * Submit Sales Order.
   */
  public function submit(SalesInvoice $salesInvoice) {
    $salesInvoice = $this->service->submit($salesInvoice);
    return redirect()->back();
  }

  public function onApproved(SalesInvoice $salesInvoice) {
    $this->service->onApproved($salesInvoice);
    return back();
  }

  public function onRejected(SalesInvoice $salesInvoice) {
    $this->service->onRejected($salesInvoice);
    return back();
  }

  public function cancel(SalesInvoice $salesInvoice) {
    $this->service->cancel($salesInvoice);
    return back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(SalesInvoice $salesInvoice) {
    DB::beginTransaction();
    $salesInvoice->delete();
    $salesInvoice->logForDeleted();
    DB::commit();
    return redirect()->back();
  }
}

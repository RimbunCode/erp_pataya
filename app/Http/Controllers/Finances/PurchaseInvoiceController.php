<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\PurchaseInvoiceRequest;
use App\Models\Core\Branch;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Core\FormatingSeries;
use App\Services\Finances\PurchaseInvoiceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseInvoiceController extends Controller {
  private PurchaseInvoiceService $service;

  public function __construct(Request $request, PurchaseInvoiceService $service) {
    $this->service = $service;
    parent::__construct($request, PurchaseInvoice::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    PurchaseInvoice::dataTable($request);

    return Inertia::render('Finances/PurchaseInvoice/Index');
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create(Request $request, string $ref = null) {
    $purchaseOrder = PurchaseOrder::with(
      "items",
      "supplier",
      "currency",
      "items.item",
      "items.unit",
      "items.warehouse",
      "paymentSchedules",
      "paymentSchedules.paymentTerm",
      "paymentSchedules.paymentMethod",
    )
      ->find($ref);
    $this->setBreadcrumbs('finances.purchaseInvoice.new');
    return Inertia::render('Finances/PurchaseInvoice/Show', [
      'date'             => now(),
      'purchase_order'   => $purchaseOrder,
      'supplier'         => $purchaseOrder?->supplier,
      'currency'         => $purchaseOrder?->currency,
      'items'            => $purchaseOrder?->items,
      'paymentSchedules' => $purchaseOrder?->paymentSchedules,
      'amount'           => $purchaseOrder?->amount,
      'discount_on'      => $purchaseOrder?->discount_on,
      'discount_rate'    => $purchaseOrder?->discount_rate,
      'discount_amount'  => $purchaseOrder?->discount_amount,
      'exchange_rate'    => $purchaseOrder?->exchange_rate,
      'external_note'    => $purchaseOrder?->external_note,
    ]);
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(PurchaseInvoiceRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();

    // branch dari session
    $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();

    // generate code
    $code               = FormatingSeries::get(PurchaseInvoice::class, $data);
    $data['code']       = $code;
    $data['created_by'] = $request->user()->id;

    // create SO
    $purchaseInvoice = $this->service->create($data);
    $purchaseInvoice->logForCreated();

    DB::commit();
    return redirect()->route('purchaseInvoices.show', $purchaseInvoice);
  }

  /**
   * Display the specified resource.
   */
  public function show(PurchaseInvoice $purchaseInvoice) {
    $this->setBreadcrumbs($purchaseInvoice);
    $purchaseInvoice->showDetail();

    return Inertia::render('Finances/PurchaseInvoice/Show', [
      'purchaseInvoice' => function () use ($purchaseInvoice) {
        $purchaseInvoice->loadRelations();
        return $purchaseInvoice;
      },
    ]);
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(PurchaseInvoiceRequest $request, PurchaseInvoice $purchaseInvoice) {
    $data = $request->validated();
    DB::beginTransaction();

    $so = $this->service->update($purchaseInvoice, $data);

    DB::commit();
    return redirect()->back();
  }

  public function submit(Request $request, PurchaseInvoice $purchaseInvoice) {
    $this->service->submit($purchaseInvoice);
    return redirect()->back();
  }

  public function onApproved(PurchaseInvoice $purchaseInvoice) {
    $this->service->onApproved($purchaseInvoice);
    return back();
  }

  public function onRejected(PurchaseInvoice $purchaseInvoice) {
    $this->service->onRejected($purchaseInvoice);
    return back();
  }

  public function cancel(PurchaseInvoice $purchaseInvoice) {
    $this->service->cancel($purchaseInvoice);
    return back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(PurchaseInvoice $purchaseInvoice) {
    DB::beginTransaction();
    $purchaseInvoice->delete();
    $purchaseInvoice->logForDeleted();
    DB::commit();
    return redirect()->back();
  }
}

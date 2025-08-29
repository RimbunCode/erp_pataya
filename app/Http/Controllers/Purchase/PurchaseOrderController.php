<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Models\Purchase\PurchaseOrder;
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
    $references = \explode('/', $ref);
    if (count($references) != 2) {
      abort(404);
    }

    return redirect()->route('purchaseOrders.index');
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(Request $request) {
    //
  }

  /**
   * Display the specified resource.
   */
  public function show(string $id) {
    //
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

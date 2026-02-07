<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\PurchaseReturnRequest;
use App\Models\Purchase\PurchaseReturn;
use App\Services\Core\FormatingSeriesService;
use App\Services\Purchase\PurchaseReturnService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseReturnController extends Controller {
  private FormatingSeriesService $referenceCodeService;
  private PurchaseReturnService  $service;

  public function __construct(
    Request $request,
    FormatingSeriesService
    $preferenceCodeService,
    PurchaseReturnService $service,
  ) {
    $this->referenceCodeService = $preferenceCodeService;
    $this->service              = $service;
    parent::__construct($request, PurchaseReturn::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    PurchaseReturn::dataTable($request);

    return Inertia::render('Purchase/PurchaseReturns/Index');
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
  public function store(PurchaseReturnRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();

    $code               = $this->referenceCodeService->get(PurchaseReturn::class, $data);
    $data['code']       = $code;
    $data['created_by'] = $request->user()->id;

    // create SO
    $so = $this->service->create($data);
    $so->logForCreated();

    DB::commit();
    return redirect()->route('purchaseReturns.show', $so);
  }

  /**
   * Display the specified resource.
   */
  public function show(PurchaseReturn $purchaseReturn) {
    $this->setBreadcrumbs($purchaseReturn);
    $purchaseReturn->showDetail();

    return Inertia::render('Purchase/PurchaseReturns/Show', [
      'purchaseReturn' => function () use ($purchaseReturn) {
        $purchaseReturn->loadRelations();
        return $purchaseReturn;
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
  public function update(PurchaseReturnRequest $request, PurchaseReturn $purchaseReturn) {
    $data = $request->validated();
    DB::beginTransaction();

    $so = $this->service->update($purchaseReturn, $data);

    DB::commit();
    return redirect()->back();
  }

  public function submit(Request $request, PurchaseReturn $purchaseReturn) {
    $so = $this->service->submit($purchaseReturn);
    return redirect()->back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(string $id) {
    //
  }
}

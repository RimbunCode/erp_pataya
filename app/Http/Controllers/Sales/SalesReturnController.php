<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\SalesReturnRequest;
use App\Models\Sales\SalesReturn;
use App\Services\Core\FormatingSeriesService;
use App\Services\Sales\SalesReturnService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SalesReturnController extends Controller {
  private FormatingSeriesService $referenceCodeService;
  private SalesReturnService     $service;

  public function __construct(Request $request, FormatingSeriesService $preferenceCodeService, SalesReturnService $service) {
    $this->referenceCodeService = $preferenceCodeService;
    $this->service              = $service;
    parent::__construct($request, SalesReturn::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    SalesReturn::dataTable($request);

    return Inertia::render('Sales/SalesReturns/Index');
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
  public function store(SalesReturnRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();

    $code               = $this->referenceCodeService->get(SalesReturn::class, $data);
    $data['code']       = $code;
    $data['created_by'] = $request->user()->id;

    // create SO
    $so = $this->service->create($data);
    $so->logForCreated();

    DB::commit();
    return redirect()->route('salesReturns.show', $so);
  }

  /**
   * Display the specified resource.
   */
  public function show(SalesReturn $salesReturn) {
    $this->setBreadcrumbs($salesReturn);
    $salesReturn->showDetail();

    return Inertia::render('Sales/SalesReturns/Show', [
      'salesReturn' => function () use ($salesReturn) {
        $salesReturn->loadRelations();
        return $salesReturn;
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
  public function update(SalesReturnRequest $request, SalesReturn $salesReturn) {
    $data = $request->validated();
    DB::beginTransaction();

    $so = $this->service->update($salesReturn, $data);

    DB::commit();
    return redirect()->back();
  }

  public function submit(Request $request, SalesReturn $salesReturn) {
    $so = $this->service->submit($salesReturn);
    return redirect()->back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(string $id) {
    //
  }
}

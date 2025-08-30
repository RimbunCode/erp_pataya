<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Models\Purchase\PurchaseRequest;
use App\Services\Core\FormatingSeriesService;
use App\Services\Purchase\PurchaseRequestService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PurchaseRequestController extends Controller {

  private FormatingSeriesService $formatingSeriesService;
  private PurchaseRequestService $service;

  public function __construct(Request $request, FormatingSeriesService $formatingSeriesService, PurchaseRequestService $service) {
    $this->formatingSeriesService = $formatingSeriesService;
    $this->service = $service;
    parent::__construct($request, PurchaseRequest::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    PurchaseRequest::dataTable($request);
    return Inertia::render('Purchase/PurchaseRequests/Index');
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

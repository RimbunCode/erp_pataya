<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\DeliveryNoteRequest;
use App\Models\Core\Branch;
use App\Models\Inventory\DeliveryNote;
use App\Services\Core\FormatingSeriesService;
use App\Services\Inventory\DeliveryNoteService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DeliveryNoteController extends Controller {
  private FormatingSeriesService $referenceCodeService;
  private DeliveryNoteService    $service;

  public function __construct(Request $request, FormatingSeriesService $preferenceCodeService, DeliveryNoteService $service) {
    $this->referenceCodeService = $preferenceCodeService;
    $this->service              = $service;
    parent::__construct($request, DeliveryNote::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    DeliveryNote::dataTable($request);

    return Inertia::render('Inventory/DeliveryNotes/Index');
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
  public function store(DeliveryNoteRequest $request) {
    try {
      $data = $request->validated();
      DB::beginTransaction();

      // branch dari session
      $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();

      // generate code
      $code               = $this->referenceCodeService->get(DeliveryNote::class, $data);
      $data['code']       = $code;
      $data['created_by'] = $request->user()->id;

      $deliveryNote = $this->service->create($data);
      $deliveryNote->logForCreated();

      DB::commit();
      return redirect()->route('deliveryNotes.show', $deliveryNote)
        ->with('success', 'DeliveryNote successfully created!');
    } catch (\Throwable $th) {
      DB::rollBack();
      throw $th;
    }
  }

  /**
   * Display the specified resource.
   */
  public function show(DeliveryNote $deliveryNote) {
    $this->setBreadcrumbs($deliveryNote);
    $deliveryNote->showDetail();

    return Inertia::render('Inventory/DeliveryNotes/Show', [
      'deliveryNote' => function () use ($deliveryNote) {
        $deliveryNote->loadRelations();
        return $deliveryNote;
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
  public function update(DeliveryNoteRequest $request, DeliveryNote $deliveryNote) {
    $data = $request->validated();
    DB::beginTransaction();

    $so = $this->service->update($deliveryNote, $data);

    DB::commit();
    return redirect()->back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(string $id) {
    //
  }

  public function submit(DeliveryNote $deliveryNote) {
    $this->service->submit($deliveryNote);
    return redirect()->back();
  }
}

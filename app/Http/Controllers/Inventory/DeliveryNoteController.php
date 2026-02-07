<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\DeliveryNoteRequest;
use App\Models\Core\Branch;
use App\Models\Inventory\DeliveryNote;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\Permission;
use App\Services\Core\FormatingSeriesService;
use App\Services\Inventory\DeliveryNoteService;
use App\Utils;
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
  public function create(Request $request, ?string $ref = null) {
    if ($ref) {
      $split    = \explode("/", $ref);
      $modelOri = $split[0] ?? null;
      if ($modelOri) {
        switch ($modelOri) {
          case 'salesOrder': {
            $so = SalesOrder::find($split[1]);
            if ($so) {
              $do = DeliveryNote::where('referenceable_type', SalesOrder::class)
                ->where('referenceable_id', $so->id)
                ->where('status', 'draft')
                ->where('created_by', $request->user()->id)
                ->first();
              if ($do) {
                return redirect()->route('deliveryNotes.show', $do);
              }
              $so->loadRelations();

              $defaultData = [
                'delivery_date'      => now(),
                'customer'           => $so->customer,
                'customer_branch'    => $so->customer_branch,
                'referenceable_type' => SalesOrder::class,
                'referenceable_id'   => $so->id,
                'referenceable'      => $so,
                'external_note'      => $so->external_note,
                'model'              => Permission::where('model', SalesOrder::class)->first(),
                'items'              => $so->items->map(fn ($item) => [
                  'id'                 => Utils::generateRandom(5),
                  'item'               => $item->item,
                  'source_warehouse'   => $item->sourceWarehouse,
                  'quantity'           => $item->undelivered_quantity,
                  'required_quantity'  => $item->undelivered_quantity,
                  'unit'               => $item->unit,
                  'referenceable_type' => SalesOrderItem::class,
                  'referenceable_id'   => $item->id,
                ]),
              ];
            }
            break;
          }
          case 'deliveryNote': {
            $doTarget = DeliveryNote::find($split[1]);
            if ($doTarget) {
              $do = DeliveryNote::where('return_against_id', $doTarget->id)
                ->where('status', 'draft')
                ->where('created_by', $request->user()->id)
                ->first();
              if ($do) {
                return redirect()->route('deliveryNotes.show', $do);
              }

              $doTarget->loadRelations();
              $defaultData = [
                'is_return'          => true,
                'return_against'     => $doTarget,
                'delivery_date'      => now(),
                'customer'           => $doTarget->customer,
                'customer_branch'    => $doTarget->customer_branch,
                'referenceable_type' => $doTarget->referenceable_type,
                'referenceable_id'   => $doTarget->referenceable_id,
                'referenceable'      => $doTarget->referenceable,
                'external_note'      => $doTarget->external_note,
                'model'              => Permission::where('model', $doTarget->referenceable_type)->first(),
                'items'              => $doTarget->items->map(fn ($item) => [
                  'id'                  => Utils::generateRandom(5),
                  'item'                => $item->item,
                  'source_warehouse'    => $item->sourceWarehouse,
                  'quantity'            => $item->remaining_quantity,
                  'required_quantity'   => $item->remaining_quantity,
                  'unit'                => $item->unit,
                  'referenceable_type'  => $item->referenceable_type,
                  'referenceable_id'    => $item->referenceable_id,
                  'return_against_item' => $item,
                ]),
              ];
            }
            break;
          }
        }
      }
    }

    $this->setBreadcrumbs('inventory.deliveryNote.new');
    return Inertia::render('Inventory/DeliveryNotes/Show', [
      'defaultData' => $defaultData ?? null,
    ]);
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

    $this->service->update($deliveryNote, $data);

    DB::commit();
    return redirect()->back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(DeliveryNote $deliveryNote) {
    DB::beginTransaction();

    $deliveryNote->delete();
    $deliveryNote->logForDeleted();

    DB::commit();
    return redirect()->back();
  }

  public function submit(DeliveryNote $deliveryNote) {
    $this->service->submit($deliveryNote);
    return redirect()->back();
  }

  public function onApproved(DeliveryNote $deliveryNote) {
    $this->service->onApproved($deliveryNote);
    return redirect()->back();
  }

  public function onRejected(DeliveryNote $deliveryNote) {
    $this->service->onRejected($deliveryNote);
    return redirect()->back();
  }

  public function cancel(DeliveryNote $deliveryNote) {
    $this->service->cancel($deliveryNote);
    return redirect()->back();
  }
}

<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\InternalOrderRequest;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Sales\InternalOrder;
use App\Services\Sales\InternalOrderService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class InternalOrderController extends Controller {
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
    public function create(Request $request, ?string $ref = null) {
        if ($ref) {
            $split    = \explode('/', $ref);
            $modelOri = $split[0] ?? null;
            if ($modelOri) {
                switch ($modelOri) {
                    case 'assetService':
                        $svc = AssetService::find($split[1]);
                        if ($svc) {
                            $svc->loadRelations();
                            $defaultData = [
                                'date'               => now(),
                                'referenceable_type' => AssetService::class,
                                'referenceable_id'   => $svc->id,
                                'referenceable'      => $svc,
                                'items'              => $svc->consumedItems->map(fn ($item) => [
                                    'id'                 => Utils::generateRandom(5),
                                    'item'               => $item->item,
                                    'quantity'           => $item->quantity,
                                    'unit'               => $item->itemUnit,
                                    'referenceable'      => $item,
                                    'referenceable_type' => AssetServiceConsumedItem::class,
                                    'referenceable_id'   => $item->id,
                                    'assetServiceLocked' => true,
                                ]),
                            ];
                        }
                        break;
                }
            }
        }

        $this->setBreadcrumbs();

        return Inertia::render('Sales/InternalOrders/Show', [
            'defaultData' => $defaultData ?? null,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(InternalOrderRequest $request) {
        try {
            $data = $request->validated();
            DB::beginTransaction();

            $data['branch_id']     = $request->session()->get('currentBranch');
            $data['created_by_id'] = $request->user()->id;

            $io = $this->service->create($data);

            DB::commit();

            return redirect()->route('internalOrders.show', $io)->with('id', $io->id);
        } catch (\Throwable $th) {
            DB::rollBack();
            throw $th;
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(InternalOrder $internalOrder) {
        $this->setBreadcrumbs($internalOrder);
        $internalOrder->showDetail();

        return Inertia::render('Sales/InternalOrders/Show', [
            'internalOrder' => function () use ($internalOrder) {
                $internalOrder->loadRelations();

                return $internalOrder;
            },
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(InternalOrderRequest $request, InternalOrder $internalOrder) {
        abort_if($internalOrder->submitted_at, 403, 'Cannot update a submitted order.');

        try {
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
        } catch (\Throwable $th) {
            DB::rollBack();
            throw $th;
        }
    }

    /**
     * Submit Sales Order.
     */
    public function submit(Request $request, InternalOrder $internalOrder) {
        $so = $this->service->submit($internalOrder);

        $so->logs()->create([
            'user_id'  => $request->user()->id,
            'activity' => [
                'en' => ':user submitted this',
                'id' => ':user telah mensubmit ini',
            ],
        ]);

        return redirect()->back();
    }
}

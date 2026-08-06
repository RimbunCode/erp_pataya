<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\PurchaseInvoiceRequest;
use App\Models\Core\Branch;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Finances\PurchaseInvoiceService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PurchaseInvoiceController extends Controller {
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
    public function create(Request $request, ?string $ref = null) {
        if ($ref) {
            $split    = \explode('/', $ref);
            $modelOri = $split[0] ?? null;
            if ($modelOri) {
                switch ($modelOri) {
                    case 'purchaseOrder':
                        $po = PurchaseOrder::find($split[1]);
                        if ($po) {
                            $purchaseInvoice = PurchaseInvoice::where('purchase_order_id', $po->id)
                                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                                ->where('created_by_id', $request->user()->id)
                                ->first();
                            if ($purchaseInvoice) {
                                return redirect()->route('purchaseInvoices.show', $purchaseInvoice);
                            }
                            $po->loadRelations();
                            $accounts = Account::where('root_type', 'liability')
                                ->whereIn('account_type', ['stock_received_but_not_billed', 'payable'])
                                ->get();

                            $defaultData = [
                                'date'                 => now(),
                                'purchase_order'       => $po,
                                'supplier'             => $po?->supplier,
                                'expense_head_account' => $accounts->where('root_type', 'liability')->where('account_type', 'stock_received_but_not_billed')->first(),
                                'credit_account'       => $accounts->where('root_type', 'liability')->where('account_type', 'payable')->first(),
                                'currency'             => $po?->currency,
                                'amount'               => $po?->amount,
                                'discount_on'          => $po?->discount_on,
                                'discount_rate'        => $po?->discount_rate,
                                'discount_amount'      => $po?->discount_amount,
                                'exchange_rate'        => $po?->exchange_rate,
                                'external_note'        => $po?->external_note,
                                'items'                => $po?->items->map(fn ($item) => [
                                    ...$item->toArray(),
                                    'id'                     => Utils::generateRandom(5),
                                    'purchase_order_item'    => $item,
                                    'purchase_order_item_id' => $item->id,
                                ]),
                                'payment_schedules' => $po?->paymentSchedules->map(fn ($paymentSchedule) => [
                                    ...$paymentSchedule->toArray(),
                                    'id' => Utils::generateRandom(5),
                                ]),
                            ];
                        }
                        break;

                    case 'purchaseInvoice':
                        $purchaseInvoice = PurchaseInvoice::find($split[1]);
                        if ($purchaseInvoice) {
                            $purchaseInvoiceTarget = PurchaseInvoice::where('return_against_id', $purchaseInvoice->id)
                                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                                ->where('created_by_id', $request->user()->id)
                                ->first();
                            if ($purchaseInvoiceTarget) {
                                return redirect()->route('purchaseInvoices.show', $purchaseInvoiceTarget);
                            }
                            $purchaseInvoice->loadRelations();
                            $defaultData = [
                                'return_against'       => $purchaseInvoice,
                                'is_return'            => true,
                                'date'                 => now(),
                                'purchase_order'       => $purchaseInvoice->purchaseOrder,
                                'expense_head_account' => $purchaseInvoice->expenseHeadAccount,
                                'credit_account'       => $purchaseInvoice->creditAccount,
                                'supplier'             => $purchaseInvoice?->supplier,
                                'currency'             => $purchaseInvoice?->currency,
                                'amount'               => $purchaseInvoice?->amount,
                                'discount_on'          => $purchaseInvoice?->discount_on,
                                'discount_rate'        => $purchaseInvoice?->discount_rate,
                                'discount_amount'      => $purchaseInvoice?->discount_amount,
                                'exchange_rate'        => $purchaseInvoice?->exchange_rate,
                                'external_note'        => $purchaseInvoice?->external_note,
                                'items'                => $purchaseInvoice?->items->map(fn ($item) => [
                                    ...$item->toArray(),
                                    'id'                     => Utils::generateRandom(5),
                                    'return_against_item_id' => $item->id,
                                ]),

                                'payment_schedules' => $purchaseInvoice?->paymentSchedules->map(fn ($paymentSchedule) => [
                                    ...$paymentSchedule->toArray(),
                                    'id' => Utils::generateRandom(5),
                                ]),
                            ];
                        }
                        break;

                }
            }
        }

        $this->setBreadcrumbs('finances.purchaseInvoice.new');

        return Inertia::render('Finances/PurchaseInvoice/Show', [
            'defaultData' => $defaultData ?? [],
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(PurchaseInvoiceRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();

        // branch dari session
        $data['branch_id']     = $request->session()->get('currentBranch');
        $data['created_by_id'] = $request->user()->id;

        // create SO
        $purchaseInvoice = $this->service->create($data);

        DB::commit();

        return redirect()->route('purchaseInvoices.show', $purchaseInvoice)->with('id', $purchaseInvoice->id);
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
}

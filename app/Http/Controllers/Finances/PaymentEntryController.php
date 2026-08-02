<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\PaymentEntryRequest;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\PaymentEntryService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PaymentEntryController extends Controller {
    public function __construct(Request $request, PaymentEntryService $service) {
        $this->service = $service;
        parent::__construct($request, PaymentEntry::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        PaymentEntry::dataTable($request);

        return Inertia::render(
            'Finances/PaymentEntries/Index',
            [],
        );
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request, ?string $ref = null) {
        if ($ref) {
            $split    = \explode('/', $ref);
            $modelOri = $split[0] ?? null;
            $id       = $split[1] ?? null;
            if ($modelOri) {
                $model = match ($modelOri) {
                    'paymentSchedule' => PaymentSchedule::class,
                    default           => null,
                };
                switch ($modelOri) {
                    case 'paymentSchedule':
                        $paymentSchedule = PaymentSchedule::find($id);

                        $modelReference = $paymentSchedule->payment_scheduleable_type;

                        if ($modelReference == SalesInvoice::class) {
                            $partyable = $paymentSchedule->referenceTo->customer;
                            $currency  = $paymentSchedule->referenceTo->currency;
                        }
                        break;

                    case 'salesInvoice':
                        $salesInvoice = SalesInvoice::find($id);
                        $paymentEntry = PaymentEntry::where('paymentable_type', SalesInvoice::class)
                            ->where('paymentable_id', $salesInvoice->id)
                            ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                            ->where('created_by_id', $request->user()->id)
                            ->first();
                        if ($paymentEntry) {
                            return redirect()->route('paymentEntries.show', $paymentEntry);
                        }
                        $salesInvoice->loadRelations();
                        ['accountBank' => $accountBank, 'amount' => $amount, 'paymentMethod' => $paymentMethod] = PaymentSchedule::getDetailPayment($salesInvoice->paymentSchedules);

                        $defaultData = [
                            'date'              => now(),
                            'paymentable'       => $salesInvoice,
                            'payment_type'      => $salesInvoice->return_against_id === null ? 'receive' : 'pay',
                            'party_type'        => 'customer',
                            'partyable'         => $salesInvoice->customer,
                            'currency'          => $salesInvoice->currency,
                            'exchange_rate'     => $salesInvoice->exchange_rate,
                            'account_paid_from' => $salesInvoice->return_against_id === null ? $salesInvoice->debitAccount : $accountBank,
                            'account_paid_to'   => $salesInvoice->return_against_id === null ? $accountBank : $salesInvoice->customer_id,
                            'paid_amount'       => $amount,
                            'payment_method'    => $paymentMethod,
                        ];
                        break;

                    case 'purchaseInvoice':
                        $purchaseInvoice = PurchaseInvoice::find($id);
                        $paymentEntry    = PaymentEntry::where('paymentable_type', PurchaseInvoice::class)
                            ->where('paymentable_id', $purchaseInvoice->id)
                            ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                            ->where('created_by_id', $request->user()->id)
                            ->first();
                        if ($paymentEntry) {
                            return redirect()->route('paymentEntries.show', $paymentEntry);
                        }
                        $purchaseInvoice->loadRelations();
                        ['accountBank' => $accountBank, 'amount' => $amount, 'paymentMethod' => $paymentMethod] = PaymentSchedule::getDetailPayment($purchaseInvoice->paymentSchedules);

                        $defaultData = [
                            'date'              => now(),
                            'paymentable'       => $purchaseInvoice,
                            'payment_type'      => $purchaseInvoice->return_against_id === null ? 'pay' : 'receive',
                            'party_type'        => 'supplier',
                            'partyable'         => $purchaseInvoice->supplier,
                            'currency'          => $purchaseInvoice->currency,
                            'exchange_rate'     => $purchaseInvoice->exchange_rate,
                            'account_paid_from' => $purchaseInvoice->return_against_id === null ? $purchaseInvoice->debitAccount : $accountBank,
                            'account_paid_to'   => $purchaseInvoice->return_against_id === null ? $accountBank : $purchaseInvoice->customer_id,
                            'paid_amount'       => $amount,
                            'payment_method'    => $paymentMethod,
                        ];
                        break;

                }
            }
        }

        $this->setBreadcrumbs('finances.paymentEntry.new');

        return Inertia::render('Finances/PaymentEntries/Show', [
            'defaultData' => $defaultData ?? null,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(PaymentEntryRequest $request) {
        $data              = $request->validated();
        $data['branch_id'] = $request->session()->get('currentBranch');
        $paymentEntry      = $this->service->create($data);

        return redirect()->route('paymentEntries.show', $paymentEntry)->with('id', $paymentEntry->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(PaymentEntry $paymentEntry) {
        $this->setBreadcrumbs($paymentEntry);
        $paymentEntry->showDetail();

        return Inertia::render('Finances/PaymentEntries/Show', [
            'paymentEntry' => function () use ($paymentEntry) {
                $paymentEntry->loadRelations([], withTrashed: true);

                return $paymentEntry;
            },
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */

    /**
     * Update the specified resource in storage.
     */
    public function update(PaymentEntryRequest $request, PaymentEntry $paymentEntry) {
        $data         = $request->validated();
        $paymentEntry = $this->service->update($paymentEntry, $data);

        return back();
    }

    // Opsional: log internal invoice submit
    public function submit(PaymentEntry $paymentEntry) {
        $this->service->submit($paymentEntry);

        return back();
    }
}

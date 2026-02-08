<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\SalesInvoiceRequest;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\SalesInvoice;
use App\Models\Sales\SalesOrder;
use App\Services\Finances\SalesInvoiceService;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SalesInvoiceController extends Controller
{
    private SalesInvoiceService $service;

    public function __construct(Request $request, SalesInvoiceService $service)
    {
        $this->service = $service;
        parent::__construct($request, SalesInvoice::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->setBreadcrumbs();
        SalesInvoice::dataTable($request);

        return Inertia::render('Finances/SalesInvoice/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request, ?string $ref = null)
    {
        if ($ref) {
            $split = \explode('/', $ref);
            $modelOri = $split[0] ?? null;
            if ($modelOri) {
                switch ($modelOri) {
                    case 'salesOrder':
                        $so = SalesOrder::find($split[1]);
                        if ($so) {
                            $salesInvoice = SalesInvoice::where('sales_order_id', $so->id)
                                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                                ->where('created_by', $request->user()->id)
                                ->first();
                            if ($salesInvoice) {
                                return redirect()->route('salesInvoices.show', $salesInvoice);
                            }
                            $so->loadRelations();
                            $accounts = Account::whereIn('root_type', ['income', 'asset'])
                                ->whereIn('account_type', ['income_account', 'receivable'])
                                ->where('is_contra', false)
                                ->get();

                            $defaultData = [
                                'date' => now(),
                                'sales_order' => $so,
                                'customer' => $so?->customer,
                                'customer_branch' => $so?->customer_branch,
                                'income_account' => $accounts->where('root_type', 'income')->where('account_type', 'income_account')->first(),
                                'debit_account' => $accounts->where('root_type', 'asset')->where('account_type', 'receivable')->first(),
                                'currency' => $so?->currency,
                                'amount' => $so?->amount,
                                'discount_on' => $so?->discount_on,
                                'discount_rate' => $so?->discount_rate,
                                'discount_amount' => $so?->discount_amount,
                                'exchange_rate' => $so?->exchange_rate,
                                'external_note' => $so?->external_note,
                                'items' => $so?->items->map(fn ($item) => [
                                    ...$item->toArray(),
                                    'id' => Utils::generateRandom(5),
                                    'sales_order_item_id' => $item->id,
                                ]),
                                'paymentSchedules' => $so?->paymentSchedules->map(fn ($paymentSchedule) => [
                                    ...$paymentSchedule->toArray(),
                                    'id' => Utils::generateRandom(5),
                                ]),
                            ];
                        }
                        break;

                    case 'salesInvoice':
                        $salesInvoice = SalesInvoice::find($split[1]);
                        if ($salesInvoice) {
                            $salesInvoiceTarget = SalesInvoice::where('return_against_id', $salesInvoice->id)
                                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                                ->where('created_by', $request->user()->id)
                                ->first();
                            if ($salesInvoiceTarget) {
                                return redirect()->route('salesInvoices.show', $salesInvoiceTarget);
                            }
                            $account = Account::where('root_type', 'income')
                                ->where('account_type', 'income_account')
                                ->where('is_contra', true)
                                ->first();
                            $salesInvoice->loadRelations();
                            $defaultData = [
                                'return_against' => $salesInvoice,
                                'is_return' => true,
                                'date' => now(),
                                'sales_order' => $salesInvoice->salesOrder,
                                'income_account' => $account,
                                'debit_account' => $salesInvoice->debitAccount,
                                'customer' => $salesInvoice?->customer,
                                'customer_branch' => $salesInvoice?->customer_branch,
                                'currency' => $salesInvoice?->currency,
                                'amount' => $salesInvoice?->amount,
                                'discount_on' => $salesInvoice?->discount_on,
                                'discount_rate' => $salesInvoice?->discount_rate,
                                'discount_amount' => $salesInvoice?->discount_amount,
                                'exchange_rate' => $salesInvoice?->exchange_rate,
                                'external_note' => $salesInvoice?->external_note,
                                'items' => $salesInvoice?->items->map(fn ($item) => [
                                    ...$item->toArray(),
                                    'id' => Utils::generateRandom(5),
                                    'return_against_item_id' => $item->id,
                                ]),

                                'paymentSchedules' => $salesInvoice?->paymentSchedules->map(fn ($paymentSchedule) => [
                                    ...$paymentSchedule->toArray(),
                                    'id' => Utils::generateRandom(5),
                                ]),
                            ];
                        }
                        break;

                }
            }
        }

        $this->setBreadcrumbs('finances.salesInvoice.new');

        return Inertia::render('Finances/SalesInvoice/Show', [
            'defaultData' => $defaultData ?? [],
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(SalesInvoiceRequest $request)
    {
        $data = $request->validated();
        DB::beginTransaction();

        // branch dari session
        $data['branch'] = Branch::find($request->session()->get('currentBranch'))->toArray();

        // generate code
        $code = FormatingSeries::get(SalesInvoice::class, $data);
        $data['code'] = $code;
        $data['created_by'] = $request->user()->id;

        // create SO
        $so = $this->service->create($data);
        $so->logForCreated();

        DB::commit();

        return redirect()->route('salesInvoices.show', $so);
    }

    /**
     * Display the specified resource.
     */
    public function show(SalesInvoice $salesInvoice)
    {
        $this->setBreadcrumbs($salesInvoice);
        $salesInvoice->showDetail();

        return Inertia::render('Finances/SalesInvoice/Show', [
            'salesInvoice' => function () use ($salesInvoice) {
                $salesInvoice->loadRelations();

                return $salesInvoice;
            },
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(SalesInvoiceRequest $request, SalesInvoice $salesInvoice)
    {
        $data = $request->validated();
        DB::beginTransaction();

        $this->service->update($salesInvoice, $data);

        DB::commit();

        return redirect()->back();
    }

    /**
     * Submit Sales Order.
     */
    public function submit(SalesInvoice $salesInvoice)
    {
        $salesInvoice = $this->service->submit($salesInvoice);

        return redirect()->back();
    }

    public function onApproved(SalesInvoice $salesInvoice)
    {
        $this->service->onApproved($salesInvoice);

        return back();
    }

    public function onRejected(SalesInvoice $salesInvoice)
    {
        $this->service->onRejected($salesInvoice);

        return back();
    }

    public function cancel(SalesInvoice $salesInvoice)
    {
        $this->service->cancel($salesInvoice);

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(SalesInvoice $salesInvoice)
    {
        DB::beginTransaction();
        $salesInvoice->delete();
        $salesInvoice->logForDeleted();
        DB::commit();

        return redirect()->back();
    }
}

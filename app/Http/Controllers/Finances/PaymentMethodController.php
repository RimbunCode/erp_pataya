<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\PaymentMethodRequest;
use App\Models\Finances\PaymentMethod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PaymentMethodController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, PaymentMethod::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        PaymentMethod::dataTable($request);

        return Inertia::render(
            'Finances/PaymentMethods/Index',
            [],
        );
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return $this->renderShow(
            'Finances/PaymentMethods/Form',
            'paymentMethod',
            null,
            new ($this->model),
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(PaymentMethodRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        if (isset($data['default_account'])) {
            $data['default_account_id'] = $data['default_account']['id'];
        }
        $paymentMethod = PaymentMethod::create($data);
        $paymentMethod->logForCreated();
        DB::commit();

        return redirect()->back()->with('id', $paymentMethod->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(PaymentMethod $paymentMethod) {
        $this->setBreadcrumbs($paymentMethod);
        $paymentMethod->showDetail();
        $paymentMethod->loadRelations();

        return $this->renderShow(
            'Finances/PaymentMethods/Form',
            'paymentMethod',
            $paymentMethod->name,
            $paymentMethod,
        );
    }

    public function update(PaymentMethodRequest $request, PaymentMethod $paymentMethod) {
        $data = $request->validated();
        DB::beginTransaction();

        $data['default_account_id'] = (isset($data['default_account'])) ? $data['default_account']['id'] : null;

        $paymentMethod->fillForUpdate($data);
        $paymentMethod->logForUpdated();
        DB::commit();

        return redirect()->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PaymentMethod $paymentMethod) {
        DB::beginTransaction();
        try {
            $paymentMethod->delete();
            $paymentMethod->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('paymentMethods.index');
    }
}

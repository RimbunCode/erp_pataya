<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\PaymentTermTemplateRequest;
use App\Models\Finances\PaymentTermTemplate;
use App\Services\Finances\PaymentTermTemplateService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PaymentTermTemplateController extends Controller {
    private PaymentTermTemplateService $service;

    public function __construct(Request $request, PaymentTermTemplateService $service) {
        $this->service = $service;
        parent::__construct($request, PaymentTermTemplate::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        PaymentTermTemplate::dataTable($request);

        return Inertia::render('Finances/PaymentTermTemplate/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return $this->renderShow(
            'Finances/PaymentTermTemplate/Form',
            'paymentTermTemplate',
            null,
            new ($this->model),
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(PaymentTermTemplateRequest $request) {
        $data = $request->validated();

        $paymentTermTemplate = $this->service->create($data);

        return redirect()->back()->with('id', $paymentTermTemplate->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(PaymentTermTemplate $paymentTermTemplate) {
        $this->setBreadcrumbs($paymentTermTemplate);
        $paymentTermTemplate->showDetail();
        $paymentTermTemplate->loadRelations();

        return $this->renderShow(
            'Finances/PaymentTermTemplate/Form',
            'paymentTermTemplate',
            $paymentTermTemplate->name,
            $paymentTermTemplate,
        );
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(PaymentTermTemplate $paymentTermTemplate) {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(PaymentTermTemplateRequest $request, PaymentTermTemplate $paymentTermTemplate) {
        $data = $request->validated();

        $this->service->update($paymentTermTemplate, $data);

        return redirect()->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PaymentTermTemplate $paymentTermTemplate) {
        DB::beginTransaction();
        try {
            $paymentTermTemplate->delete();
            $paymentTermTemplate->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('paymentTermTemplates.index');
    }
}

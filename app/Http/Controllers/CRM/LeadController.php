<?php

namespace App\Http\Controllers\CRM;

use App\Http\Controllers\Controller;
use App\Http\Requests\CRM\LeadRequest;
use App\Models\CRM\Lead;
use App\Services\CRM\LeadService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class LeadController extends Controller {
    private LeadService $leadService;

    public function __construct(Request $request, LeadService $leadService) {
        $this->leadService = $leadService;
        parent::__construct($request, Lead::class);
    }

    protected function matchMethodWithPermission(string $method) {
        if ($method === 'convert') {
            $this->guard('write', 0);

            return true;
        }
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        Lead::dataTable($request);

        return Inertia::render('CRM/Leads/Index', []);
    }

    public function create() {
        $this->setBreadcrumbs();
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(LeadRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['lead_source_id'] = $data['lead_source']['code'] ?? null;
        $data['country_id']     = $data['country']['code'] ?? null;
        $data['assigned_to_id'] = $data['assigned_to']['id'] ?? null;
        $lead                   = Lead::create($data);
        $lead->logForCreated();
        DB::commit();

        return back()->with('id', $lead->id);
    }

    public function show(Lead $lead) {
        $this->setBreadcrumbs($lead);
        $lead->showDetail();

        return $this->renderShow(
            'CRM/Leads/Form',
            'lead',
            $lead->company_name,
            function () use ($lead) {
                $lead->loadRelations();

                return $lead;
            },
        );
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function update(LeadRequest $request, Lead $lead) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['lead_source_id'] = $data['lead_source']['code'] ?? null;
        $data['country_id']     = $data['country']['code'] ?? null;
        $data['assigned_to_id'] = $data['assigned_to']['id'] ?? null;
        $lead->fillForUpdate($data);
        $lead->logForUpdated();
        DB::commit();

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Lead $lead) {
        DB::beginTransaction();
        $lead->delete();
        $lead->logForDeleted();
        DB::commit();

        return redirect()->route('leads.index');
    }

    public function convert(Lead $lead) {
        DB::beginTransaction();
        $customer = $this->leadService->convertToCustomer($lead);
        $lead->logForUpdated();
        DB::commit();

        return back()->with('id', $customer->id);
    }
}

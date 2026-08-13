<?php

namespace App\Http\Controllers\CRM;

use App\Events\CRM\LeadConvertedToCustomer;
use App\Http\Controllers\Controller;
use App\Http\Requests\CRM\LeadRequest;
use App\Models\CRM\Lead;
use App\Services\CRM\LeadService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class LeadController extends Controller {
    private LeadService $leadService;

    public function __construct(Request $request, LeadService $leadService) {
        $this->leadService = $leadService;
        parent::__construct($request, Lead::class);
    }

    protected function enforcePermission(string $method) {
        if ($method === 'convert') {
            return 'write';
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
        $this->leadService->storeActivities($lead, $data['activities'] ?? []);
        DB::commit();

        return back()->with('id', $lead->id);
    }

    public function show(Lead $lead) {
        $this->setBreadcrumbs($lead);
        $lead->showDetail();

        return Inertia::render('CRM/Leads/Show', [
            'lead' => function () use ($lead) {
                $lead->loadRelations();

                return $lead;
            },
        ]);
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
        $this->leadService->storeActivities($lead, $data['activities'] ?? []);
        DB::commit();

        return back();
    }

    public function convert(Lead $lead) {
        if ($lead->converted_customer_id) {
            return back()->with('id', $lead->converted_customer_id);
        }

        $customerId = (string) Str::ulid();

        DB::beginTransaction();
        try {
            event(new LeadConvertedToCustomer($lead, $customerId, [
                'name'       => $lead->company_name,
                'email'      => $lead->email,
                'phone'      => $lead->phone,
                'street'     => $lead->street,
                'city'       => $lead->city,
                'province'   => $lead->province,
                'zip_code'   => $lead->zip_code,
                'country_id' => $lead->country_id,
            ]));
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return back()->with('id', $customerId);
    }
}

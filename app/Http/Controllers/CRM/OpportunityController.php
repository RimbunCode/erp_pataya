<?php

namespace App\Http\Controllers\CRM;

use App\Http\Controllers\Controller;
use App\Http\Requests\CRM\OpportunityRequest;
use App\Models\CRM\Lead;
use App\Models\CRM\Opportunity;
use App\Services\CRM\OpportunityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class OpportunityController extends Controller {
    public function __construct(Request $request, OpportunityService $service) {
        $this->service = $service;
        parent::__construct($request, Opportunity::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        Opportunity::dataTable($request);

        return Inertia::render('CRM/Opportunities/Index', []);
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
                    case 'lead':
                        $lead = Lead::find($split[1]);
                        if ($lead) {
                            $defaultData = [
                                'title'    => "Opportunity - {$lead->company_name}",
                                'lead'     => $lead,
                                'customer' => $lead->convertedCustomer,
                            ];
                        }
                        break;
                }
            }
        }

        $this->setBreadcrumbs('crm.opportunity.new');

        return Inertia::render('CRM/Opportunities/Show', [
            'defaultData' => $defaultData ?? null,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(OpportunityRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $opportunity = $this->service->create($data);
        $opportunity->logForCreated();
        DB::commit();

        return redirect()->route('opportunities.show', $opportunity)->with('id', $opportunity->id);
    }

    public function show(Opportunity $opportunity) {
        $this->setBreadcrumbs($opportunity);
        $opportunity->showDetail();

        return Inertia::render('CRM/Opportunities/Show', [
            'opportunity' => function () use ($opportunity) {
                $opportunity->loadRelations();

                return $opportunity;
            },
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(OpportunityRequest $request, Opportunity $opportunity) {
        $data = $request->validated();
        DB::beginTransaction();
        $this->service->update($opportunity, $data);
        $opportunity->logForUpdated();
        DB::commit();

        return back();
    }
}

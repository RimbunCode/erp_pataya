<?php

namespace App\Http\Controllers\CRM;

use App\Http\Controllers\Controller;
use App\Http\Requests\CRM\QuotationRequest;
use App\Models\CRM\Opportunity;
use App\Models\CRM\Quotation;
use App\Services\CRM\QuotationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class QuotationController extends Controller {
    public function __construct(Request $request, QuotationService $service) {
        $this->service = $service;
        parent::__construct($request, Quotation::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        Quotation::dataTable($request);

        return Inertia::render('CRM/Quotations/Index', []);
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
                    case 'opportunity':
                        $opportunity = Opportunity::find($split[1]);
                        if ($opportunity) {
                            $existingDraft = Quotation::where('referenceable_type', Opportunity::class)
                                ->where('referenceable_id', $opportunity->id)
                                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                                ->where('created_by_id', $request->user()->id)
                                ->first();
                            if ($existingDraft) {
                                return redirect()->route('quotations.show', $existingDraft);
                            }
                            $defaultData = [
                                'date'               => now(),
                                'customer'           => $opportunity->customer,
                                'opportunity'        => $opportunity,
                                'referenceable_type' => Opportunity::class,
                                'referenceable_id'   => $opportunity->id,
                                'referenceable'      => $opportunity,
                            ];
                        }
                        break;
                }
            }
        }

        $this->setBreadcrumbs('crm.quotation.new');

        return Inertia::render('CRM/Quotations/Show', [
            'defaultData' => $defaultData ?? null,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(QuotationRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['branch_id']     = $request->session()->get('currentBranch');
        $data['created_by_id'] = $request->user()->id;
        $quotation             = $this->service->create($data);
        DB::commit();

        return redirect()->route('quotations.show', $quotation)->with('id', $quotation->id);
    }

    public function show(Quotation $quotation) {
        $this->setBreadcrumbs($quotation);
        $quotation->showDetail();

        return Inertia::render('CRM/Quotations/Show', [
            'quotation' => function () use ($quotation) {
                $quotation->loadRelations();

                return $quotation;
            },
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(QuotationRequest $request, Quotation $quotation) {
        $data = $request->validated();
        DB::beginTransaction();
        $this->service->update($quotation, $data);
        DB::commit();

        return redirect()->back();
    }

    /**
     * Submit Quotation.
     */
    public function submit(Request $request, Quotation $quotation) {
        $this->service->submit($quotation);

        return redirect()->back();
    }
}

<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\TaxRequest;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Tax\UnclassifiedTaxUsage;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\HttpException;

class TaxesController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Tax::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        Tax::dataTable($request);

        return Inertia::render(
            'Finances/Taxes/Index',
            [],
        );
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return $this->renderShow(
            'Finances/Taxes/Form',
            'tax',
            null,
            new ($this->model),
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(TaxRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $tax = Tax::create($data);
        DB::commit();

        return redirect()->back()->with('id', $tax->id);
    }

    /**
     * Display the specified resource.
     *
     * Tab "Versi Aturan" (Finance Fase 3, Requirement 10.1) hanya menerima data bila pembaca punya izin `read` pada
     * `TaxRuleVersion`; izin tidak dimiliki berarti tab disembunyikan, bukan halaman Pajak ditolak.
     */
    public function show(Tax $tax) {
        $this->setBreadcrumbs($tax);
        $tax->showDetail();

        $canViewVersions = $this->hasVersionPermission('read');

        return $this->renderShow(
            'Finances/Taxes/Form',
            'tax',
            $tax->name,
            $tax,
            [
                'canViewRuleVersions'   => $canViewVersions,
                'canManageRuleVersions' => $canViewVersions && $this->hasVersionPermission('manage_rule_versions'),
                'ruleVersions'          => $canViewVersions ? $this->ruleVersionRows($tax) : [],
                'ruleVersionDefaults'   => [
                    'dpp_numerator'   => TaxRuleVersion::LEGACY_DPP_NUMERATOR,
                    'dpp_denominator' => TaxRuleVersion::LEGACY_DPP_DENOMINATOR,
                    'rounding_mode'   => TaxRuleVersion::ROUNDING_PER_LINE,
                    'output_role'     => TaxRuleVersion::DEFAULT_OUTPUT_ROLE,
                    'input_role'      => TaxRuleVersion::DEFAULT_INPUT_ROLE,
                ],
                'unclassifiedUsage' => $tax->category === Tax::CATEGORY_UNCLASSIFIED
                    ? app(UnclassifiedTaxUsage::class)->invoiceCounts($tax->getKey(), CarbonImmutable::now())
                    : null,
            ],
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function ruleVersionRows(Tax $tax): array {
        return $tax->ruleVersions()
            ->with('createdBy:id,name')
            ->orderByDesc('version')
            ->get()
            ->map(fn (TaxRuleVersion $version): array => [
                'id'              => $version->id,
                'version'         => $version->version,
                'status'          => $version->status,
                'effective_from'  => $version->effective_from?->toDateString(),
                'effective_to'    => $version->effective_to?->toDateString(),
                'rate'            => $version->rate,
                'dpp_numerator'   => $version->dpp_numerator,
                'dpp_denominator' => $version->dpp_denominator,
                'rounding_mode'   => $version->rounding_mode,
                'output_role'     => $version->output_role,
                'input_role'      => $version->input_role,
                'notes'           => $version->notes,
                'created_by'      => $version->createdBy?->name,
            ])
            ->all();
    }

    private function hasVersionPermission(string $action): bool {
        try {
            TaxRuleVersion::_checkPermission($action);
        } catch (HttpException) {
            return false;
        }

        return true;
    }

    public function update(TaxRequest $request, Tax $tax) {
        $data = $request->validated();
        DB::beginTransaction();
        $tax->fillForUpdate($data);
        DB::commit();

        return redirect()->back();
    }
}

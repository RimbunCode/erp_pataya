<?php

namespace App\Http\Controllers\Asset;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssetServiceActivityRequest;
use App\Http\Requests\Asset\AssetServiceRequest;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceActivity;
use App\Services\Asset\AssetServiceService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use LogicException;

class AssetServiceController extends Controller {
    private AssetServiceService $assetServiceService;

    public function __construct(Request $request) {
        parent::__construct($request, AssetService::class);
        $this->assetServiceService = app(AssetServiceService::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        AssetService::dataTable($request);

        return Inertia::render('Asset/Services/Index');
    }

    public function create(Request $request) {
        $this->setBreadcrumbs();

        return Inertia::render('Asset/Services/Show');
    }

    public function store(AssetServiceRequest $request) {
        $assetService = $this->assetServiceService->create($request->validated());

        return redirect()->route('assetServices.show', $assetService)->with('id', $assetService->id);
    }

    public function show(AssetService $assetService) {
        $this->setBreadcrumbs($assetService);
        $assetService->showDetail();

        return Inertia::render('Asset/Services/Show', [
            'assetService' => function () use ($assetService) {
                $assetService->loadRelations();

                return array_merge($assetService->toArray(), [
                    // Requirement 6, spec asset-service-billing: dihitung sekali
                    // di sini (bukan Asset::$appends generik) supaya tidak
                    // membebani setiap query/listing Asset lain.
                    'has_active_renter' => (bool) $assetService->resolvedAsset()?->activeRenter(),
                ]);
            },
        ]);
    }

    public function update(AssetServiceRequest $request, AssetService $assetService) {
        $this->assetServiceService->update($assetService, $request->validated());

        return back();
    }

    public function submit(AssetService $assetService) {
        $this->assetServiceService->submit($assetService);

        return back();
    }

    public function complete(AssetService $assetService) {
        $this->assetServiceService->complete($assetService);

        return back();
    }

    /**
     * Requirement 6, spec asset-service-billing: tandai servis ditagih ke
     * penyewa aktif Asset (bukan pemilik) — snapshot customer/customer_branch.
     */
    public function billToRenter(AssetService $assetService) {
        $assetService->billToRenter();

        return back();
    }

    protected function enforcePermission(string $method) {
        return match ($method) {
            'complete', 'storeActivity', 'updateActivity', 'billToRenter' => 'write',
            default => parent::enforcePermission($method),
        };
    }

    public function storeActivity(AssetServiceActivityRequest $request, AssetService $assetService) {
        $this->assertApproved($assetService);

        $assetService->activities()->create($request->validated());

        return back();
    }

    public function updateActivity(AssetServiceActivityRequest $request, AssetServiceActivity $activity) {
        $this->assertApproved($activity->assetService);

        $activity->update($request->validated());

        return back();
    }

    private function assertApproved(AssetService $assetService): void {
        if (! in_array(FormStatus::APPROVED, $assetService->status ?? [], true)) {
            throw new LogicException(__('asset/service.activity_requires_approval'));
        }
    }
}

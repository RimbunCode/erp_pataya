<?php

namespace App\Http\Controllers\Asset;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssetServiceActivityRequest;
use App\Http\Requests\Asset\AssetServiceRequest;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceActivity;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Services\Asset\AssetServiceService;
use App\Services\Core\BufferedAttachmentService;
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
                    // Eloquent otomatis snake_case relation key (consumedItems()
                    // -> "consumed_items", itemUnit() -> "item_unit") saat
                    // toArray(), padahal Form.jsx (dan payload create/update)
                    // memakai key camelCase "consumedItems" dgn sub-key "unit" --
                    // remap eksplisit di sini supaya bentuk read selaras bentuk
                    // write, tanpa mengubah kontrak request/validasi yang sudah ada.
                    'consumedItems' => $assetService->consumedItems->map(
                        fn ($consumedItem) => array_merge($consumedItem->toArray(), [
                            'unit' => $consumedItem->itemUnit,
                        ]),
                    ),
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
            'complete', 'storeActivity', 'updateActivity', 'billToRenter',
            'addActivityFile', 'removeActivityFile' => 'write',
            default                                 => parent::enforcePermission($method),
        };
    }

    public function storeActivity(AssetServiceActivityRequest $request, AssetService $assetService) {
        $this->assertApproved($assetService);

        $activity = $assetService->activities()->create($request->validated());
        BufferedAttachmentService::attach($activity, $request);

        return back();
    }

    public function updateActivity(AssetServiceActivityRequest $request, AssetServiceActivity $activity) {
        $this->assertApproved($activity->assetService);

        $activity->update($request->validated());

        return back();
    }

    public function addActivityFile(Request $request, AssetServiceActivity $activity) {
        $this->assertApproved($activity->assetService);

        File::uploadFile($request, 'AssetServiceActivity', function ($file) use ($activity) {
            Fileable::firstOrCreate([
                'fileable_id'   => $activity->id,
                'fileable_type' => AssetServiceActivity::class,
                'file_id'       => $file->id,
            ]);
        });

        return back();
    }

    public function removeActivityFile(Request $request, AssetServiceActivity $activity, File $file) {
        $this->assertApproved($activity->assetService);

        Fileable::where('fileable_id', $activity->id)
            ->where('fileable_type', AssetServiceActivity::class)
            ->where('file_id', $file->id)
            ->delete();

        return back();
    }

    private function assertApproved(AssetService $assetService): void {
        if (! in_array(FormStatus::APPROVED, $assetService->status ?? [], true)) {
            throw new LogicException(__('asset/service.activity_requires_approval'));
        }
    }
}

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
use App\Models\Inventory\Stock;
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
                    // Requirement 5, spec asset-service-progress-workflow:
                    // gate visibilitas tombol "Mulai pekerjaan" di FE -- UX
                    // saja, startWork() TETAP validasi ulang server-side.
                    'has_available_stock' => $this->assetServiceService->hasStockAvailable($assetService),
                    // Requirement 8: FE pakai ini, BUKAN cek status "approved" literal.
                    'has_passed_approval' => $assetService->hasPassedApproval(),
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

    /**
     * Requirement 5, spec asset-service-progress-workflow: mulai pekerjaan
     * dari dialog Confirm.
     */
    public function startWork(AssetService $assetService) {
        $this->assetServiceService->startWork($assetService);

        return back();
    }

    /**
     * Requirement 2 AC3/AC4, spec asset-service-progress-workflow: breakdown
     * stok ready per gudang, hanya consumedItem is_stock_item=true.
     */
    public function stockAvailability(AssetService $assetService) {
        $itemVariantIds = $assetService->consumedItems()
            ->whereHas('item', fn ($q) => $q->where('is_stock_item', true))
            ->pluck('item_id');

        $stocks = Stock::whereIn('item_variant_id', $itemVariantIds)
            ->whereHas('warehouse', fn ($q) => $q->where('branch_id', $assetService->branch_id))
            ->with(['itemVariant.item', 'warehouse'])
            ->get(['id', 'item_variant_id', 'warehouse_id', 'ready_quantity']);

        return response()->json($stocks);
    }

    protected function enforcePermission(string $method) {
        return match ($method) {
            'complete', 'storeActivity', 'updateActivity', 'billToRenter',
            'addActivityFile', 'removeActivityFile', 'startWork' => 'write',
            'stockAvailability' => 'read',
            default             => parent::enforcePermission($method),
        };
    }

    public function storeActivity(AssetServiceActivityRequest $request, AssetService $assetService) {
        $this->assertApproved($assetService);

        // Requirement 9 AC9: activity tidak bisa ditambah lagi setelah
        // AssetService mencapai COMPLETED (CREATE saja -- updateActivity()
        // SENGAJA tidak kena guard ini, lihat requirements.md Req 9 AC9
        // catatan cakupan).
        if (in_array(FormStatus::COMPLETED, $assetService->status ?? [], true)) {
            throw new LogicException(__('asset/service.activity_locked_after_completed'));
        }

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
        if (! $assetService->hasPassedApproval()) {
            throw new LogicException(__('asset/service.activity_requires_approval'));
        }
    }
}

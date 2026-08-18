<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssetMaintenanceRequest;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTask;
use App\Services\Asset\Maintenance\AssetMaintenanceService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AssetMaintenanceController extends Controller {
    private AssetMaintenanceService $assetMaintenanceService;

    public function __construct(Request $request) {
        parent::__construct($request, AssetMaintenance::class);
        $this->assetMaintenanceService = app(AssetMaintenanceService::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        AssetMaintenance::dataTable($request);

        return Inertia::render('Asset/Maintenances/Index');
    }

    public function create(Request $request) {
        $this->setBreadcrumbs();

        return $this->renderShow(
            'Asset/Maintenances/Show',
            'assetMaintenance',
            null,
            new AssetMaintenance,
        );
    }

    public function store(AssetMaintenanceRequest $request) {
        $data        = $request->validated();
        $maintenance = $this->assetMaintenanceService->create($data);

        foreach ($data['tasks'] ?? [] as $taskData) {
            $this->assetMaintenanceService->createTask($maintenance, $taskData);
        }

        return redirect()->route('assetMaintenances.show', $maintenance)->with('id', $maintenance->id);
    }

    public function show(AssetMaintenance $assetMaintenance) {
        $this->setBreadcrumbs($assetMaintenance);
        $assetMaintenance->showDetail();
        $assetMaintenance->loadRelations();

        return $this->renderShow(
            'Asset/Maintenances/Show',
            'assetMaintenance',
            $assetMaintenance->asset?->asset_name,
            $assetMaintenance,
        );
    }

    public function update(AssetMaintenanceRequest $request, AssetMaintenance $assetMaintenance) {
        $this->assetMaintenanceService->update($assetMaintenance, $request->validated());

        return back();
    }

    public function storeTask(AssetMaintenanceRequest $request, AssetMaintenance $assetMaintenance) {
        $this->assetMaintenanceService->createTask($assetMaintenance, $request->validated());

        return back();
    }

    public function updateTask(AssetMaintenanceRequest $request, AssetMaintenanceTask $task) {
        $this->assetMaintenanceService->updateTask($task, $request->validated());

        return back();
    }

    public function destroyTask(AssetMaintenanceTask $task) {
        $this->assetMaintenanceService->deleteTask($task);

        return back();
    }

    protected function enforcePermission(string $method) {
        return match ($method) {
            'storeTask'   => 'create',
            'updateTask'  => 'write',
            'destroyTask' => 'delete',
            default       => parent::enforcePermission($method),
        };
    }
}

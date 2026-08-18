<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssetMaintenanceTeamRequest;
use App\Models\Asset\Maintenance\AssetMaintenanceTeam;
use App\Services\Asset\Maintenance\AssetMaintenanceTeamService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AssetMaintenanceTeamController extends Controller {
    private AssetMaintenanceTeamService $assetMaintenanceTeamService;

    public function __construct(Request $request) {
        parent::__construct($request, AssetMaintenanceTeam::class);
        $this->assetMaintenanceTeamService = app(AssetMaintenanceTeamService::class);
    }

    public function index(Request $request) {
        $this->setBreadcrumbs();
        AssetMaintenanceTeam::dataTable($request);

        return Inertia::render('Asset/MaintenanceTeams/Index');
    }

    public function create() {
        $this->setBreadcrumbs();

        return $this->renderShow(
            'Asset/MaintenanceTeams/Form',
            'assetMaintenanceTeam',
            null,
            new AssetMaintenanceTeam,
        );
    }

    public function store(AssetMaintenanceTeamRequest $request) {
        $team = $this->assetMaintenanceTeamService->create($request->validated());

        return redirect()->back()->with('id', $team->id);
    }

    public function show(AssetMaintenanceTeam $assetMaintenanceTeam) {
        $this->setBreadcrumbs($assetMaintenanceTeam);
        $assetMaintenanceTeam->showDetail();
        $assetMaintenanceTeam->loadRelations();

        return $this->renderShow(
            'Asset/MaintenanceTeams/Form',
            'assetMaintenanceTeam',
            $assetMaintenanceTeam->team_name,
            $assetMaintenanceTeam,
        );
    }

    public function update(AssetMaintenanceTeamRequest $request, AssetMaintenanceTeam $assetMaintenanceTeam) {
        $this->assetMaintenanceTeamService->update($assetMaintenanceTeam, $request->validated());

        return back();
    }
}

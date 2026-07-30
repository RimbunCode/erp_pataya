<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\WarehouseRequest;
use App\Models\Inventory\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class WarehouseController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Warehouse::class);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        Warehouse::dataTable($request);

        return Inertia::render('Inventory/Warehouses/Index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        $this->setBreadcrumbs();

        return $this->renderShow(
            'Inventory/Warehouses/Form',
            'warehouse',
            null,
            new ($this->model),
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(WarehouseRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();

        $data['branch_id'] = isset($data['branch']) ? $data['branch']['id'] : $request->session()->get('currentBranch');
        if (isset($data['pic'])) {
            $data['user_id'] = $data['pic']['id'];
        }
        $warehouse = Warehouse::create($data);
        $warehouse->logForCreated();
        DB::commit();

        return back()->with('id', $warehouse->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(Warehouse $warehouse) {
        $this->setBreadcrumbs($warehouse);
        $warehouse->showDetail();

        return $this->renderShow(
            'Inventory/Warehouses/Form',
            'warehouse',
            $warehouse->title,
            function () use ($warehouse) {
                $warehouse->loadRelations();

                return $warehouse;
            },
        );
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(WarehouseRequest $request, Warehouse $warehouse) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['branch_id'] = isset($data['branch']) ? $data['branch']['id'] : $request->session()->get('currentBranch');
        if (isset($data['pic'])) {
            $data['user_id'] = $data['pic']['id'];
        }
        $warehouse->fillForUpdate($data);
        $warehouse->logForUpdated();
        DB::commit();

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Warehouse $warehouse) {
        DB::beginTransaction();
        try {
            $warehouse->delete();
            $warehouse->logForDeleted();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return redirect()->route('warehouses.index');
    }
}

<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\WarehouseRequest;
use App\Models\Core\Branch;
use App\Models\Inventory\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
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
    $warehouse = Warehouse::query()
      ->leftJoin('branches', 'branches.id', '=', 'warehouses.branch_id')
      ->leftJoin('users', 'users.id', '=', 'warehouses.user_id')
      ->select([
        'branches.name as branch_name',
        'users.name as user_name',
        'users.username as user_username',
        'users.email as user_email',
        'users.phone as user_phone',
      ]);

    if (Session::has('currentBranch')) {
      $branch = Branch::find(Session::get('currentBranch'));
      if (!$branch->is_main_branch) {
        $warehouse->where('warehouses.branch_id', $branch->id);
      }
    }
    $warehouse->dataTable($request);
    return Inertia::render('Inventory/Warehouses/Index', [
      'branches' => Inertia::defer(function () {
        $branches =  Branch::whereNull('branchable_type')
          ->whereNull('branchable_id');

        if (Session::has('currentBranch')) {
          $branch = Branch::find(Session::get('currentBranch'));
          if (!$branch->is_main_branch) {
            $branches->where('id', $branch->id);
          }
        }

        return $branches->get();
      })
    ]);
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create() {
    //
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(WarehouseRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();
    $warehouse = Warehouse::create($data);
    $warehouse->logs()->create(
      [
        'user_id' => $request->user()->id,
        'activity' => [
          'en' => ':user created this',
          'id' => ':user telah membuat ini',
        ]
      ]
    );
    DB::commit();
    return redirect()->back();
  }

  /**
   * Display the specified resource.
   */
  public function show(Warehouse $warehouse) {
    $this->setBreadcrumbs($warehouse);
    $warehouse->showDetail();
    return Inertia::render('Inventory/Warehouses/Show', [
      'warehouse' => function () use ($warehouse) {
        $warehouse->load('pic');
        return $warehouse;
      },
      'branches' => Inertia::defer(function () {
        $branches =  Branch::whereNull('branchable_type')
          ->whereNull('branchable_id');

        if (Session::has('currentBranch')) {
          $branch = Branch::find(Session::get('currentBranch'));
          if (!$branch->is_main_branch) {
            $branches->where('id', $branch->id);
          }
        }

        return $branches->get();
      })
    ]);
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(WarehouseRequest $request, Warehouse $warehouse) {
    $data = $request->validated();
    DB::beginTransaction();
    $warehouse->update($data);
    $warehouse->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user updated this',
        'id' => ':user memperbarui ini'
      ]
    ]);
    DB::commit();
    return back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Warehouse $warehouse) {
    $warehouse->delete();
    return redirect()->back();
  }
}

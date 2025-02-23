<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\BranchRequest;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class BranchController extends Controller {

  public function __construct(Request $request) {
    parent::__construct($request, Branch::class);
  }
  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    Branch::whereNull('branchable_type')
      ->whereNull('branchable_id')
      ->dataTable($request);
    return Inertia::render('Settings/Branches/Index');
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
  public function store(Request $request) {
    //
  }

  /**
   * Display the specified resource.
   */
  public function show(Branch $branch) {
    $this->setBreadcrumbs($branch);
    $branch->showDetail();
    return Inertia::render('Settings/Branches/Show', [
      'branch' => $branch,
      'countries' => Inertia::defer(function () {
        return Country::all();
      })
    ]);
  }


  /**
   * Update the specified resource in storage.
   */
  public function update(BranchRequest $request, Branch $branch) {
    $data = $request->validated();
    DB::beginTransaction();
    $branch->update($data);
    $branch->logs()->create([
      'user_id' => $branch->id,
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
  public function destroy(Branch $branch) {
    //
  }
}

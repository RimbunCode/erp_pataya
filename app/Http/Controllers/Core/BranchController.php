<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\BranchRequest;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
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

  public function switch(Request $request, string $id) {
    $request->session()->forget('currentBranch');
    $request->session()->put('currentBranch', $id);
    return redirect()->back();
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
  public function store(BranchRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();
    if (isset($data['shipping_country'])) {
      $data['shipping_country_id'] = $data['shipping_country']['code'];
    }
    if (isset($data['billing_country'])) {
      $data['billing_country_id'] = $data['billing_country']['code'];
    }
    $branch = Branch::create($data);
    $branch->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user created this',
        'id' => ':user membuat ini'
      ]
    ]);
    DB::commit();
    return back();
  }

  /**
   * Display the specified resource.
   */
  public function show(Branch $branch) {
    if ($branch->branchable_type) {
      abort(404);
    }
    $this->setBreadcrumbs($branch);
    $branch->showDetail();
    $branch->load('shippingCountry', 'billingCountry');
    return Inertia::render('Settings/Branches/Show', [
      'branch' => $branch,
    ]);
  }


  /**
   * Update the specified resource in storage.
   */
  public function update(BranchRequest $request, Branch $branch) {
    if ($branch->branchable_type) {
      abort(404);
    }
    $data = $request->validated();
    DB::beginTransaction();
    if (isset($data['shipping_country'])) {
      $data['shipping_country_id'] = $data['shipping_country']['code'];
    }
    if (isset($data['billing_country'])) {
      $data['billing_country_id'] = $data['billing_country']['code'];
    }
    $branch->update($data);
    $branch->logs()->create([
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
  public function destroy(Branch $branch) {
    if ($branch->is_main_branch) {
      abort(403);
    }
    $branch->delete();
    return back();
  }
}

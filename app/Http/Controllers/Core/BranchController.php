<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Branch;
use Illuminate\Http\Request;
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
    Branch::dataTable($request);
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
    //
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function edit(Branch $branch) {
    //
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(Request $request, Branch $branch) {
    //
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Branch $branch) {
    //
  }
}

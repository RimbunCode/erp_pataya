<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\TaxRequest;
use App\Models\Finances\Tax;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TaxesController extends Controller
{
  public function __construct(Request $request)
  {
    parent::__construct($request, Tax::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request)
  {
    $this->setBreadcrumbs();
    Tax::dataTable($request);
    return Inertia::render(
      'Finances/Taxes/Index',
      []
    );
  }
  /**
   * Show the form for creating a new resource.
   */
  public function create()
  {
    //
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(TaxRequest $request)
  {
    $data = $request->validated();
    DB::beginTransaction();
    $tax = Tax::create($data);
    DB::commit();
    return redirect()->back();
  }

  /**
   * Display the specified resource.
   */
  public function show(Tax $tax)
  {
    $this->setBreadcrumbs($tax);
    $tax->showDetail();
    return $this->renderShow(
      'Finances/Taxes/Form',
      "tax",
      $tax->name,
      $tax
    );
  }


  public function update(TaxRequest $request, Tax $tax)
  {
    $data = $request->validated();
    DB::beginTransaction();
    $tax->update($data);
    DB::commit();
    return redirect()->back();
  }
  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Tax $tax)
  {
    $tax->delete();
    return redirect()->back();
  }
}

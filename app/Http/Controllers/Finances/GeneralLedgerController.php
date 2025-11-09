<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Models\Finances\GeneralLedger;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GeneralLedgerController extends Controller
{

  public function __construct(Request $request)
  {
    parent::__construct($request, GeneralLedger::class);
  }
  /**
   * Display a listing of the resource.
   */
  public function index(Request $request)
  {
    $this->setBreadcrumbs();
    GeneralLedger::dataTable($request);
    return Inertia::render(
      'Finances/GeneralLedger',
      []
    );
  }

  /**
   * Show the form for creating a new resource.
   */


  /**
   * Display the specified resource.
   */
  public function show(GeneralLedger $generalLedger)
  {
    $this->setBreadcrumbs($generalLedger);
    $generalLedger->showDetail();

    return Inertia::render('Finances/GeneralLedgers', [
      'generalLedger' => function () use ($generalLedger) {
        $generalLedger->loadRelations();
        return $generalLedger;
      },
    ]);
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function edit(string $id)
  {
    //
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(Request $request, string $id)
  {
    //
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(string $id)
  {
    //
  }
}

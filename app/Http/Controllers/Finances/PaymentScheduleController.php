<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Models\Finances\PaymentSchedule;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PaymentScheduleController extends Controller
{

  public function __construct(Request $request)
  {
    parent::__construct($request, PaymentSchedule::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request)
  {
    $this->setBreadcrumbs();
    PaymentSchedule::dataTable($request);
    return Inertia::render(
      'Finances/PaymentSchedules/Index',
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
  public function store(Request $request)
  {
    //
  }

  /**
   * Display the specified resource.
   */
  public function show(string $id)
  {
    //
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

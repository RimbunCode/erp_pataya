<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\PaymentTermRequest;
use App\Models\Finances\PaymentTerm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PaymentTermController extends Controller {
  public function __construct(Request $request) {
    parent::__construct($request, PaymentTerm::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    PaymentTerm::dataTable($request);

    return Inertia::render(
      'Finances/PaymentTerms/Index',
      [],
    );
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
  public function store(PaymentTermRequest $request) {
    $data = $request->validated();
    if ($request->has('payment_method')) {
      $data['payment_method_id'] = $data['payment_method']['id'];
    }
    DB::beginTransaction();
    $paymentTerm = PaymentTerm::create($data);
    $paymentTerm->logForCreated();
    DB::commit();
    return redirect()->back()->with('id', $paymentTerm->id);
  }

  /**
   * Display the specified resource.
   */
  public function show(PaymentTerm $paymentTerm) {
    $this->setBreadcrumbs($paymentTerm);
    $paymentTerm->showDetail();
    return $this->renderShow(
      'Finances/PaymentTerms/Form',
      "paymentTerm",
      $paymentTerm->name,
      $paymentTerm,
    );
  }

  public function update(PaymentTermRequest $request, PaymentTerm $paymentTerm) {
    $data                      = $request->validated();
    $data['payment_method_id'] = $data['payment_method']['id'];
    DB::beginTransaction();
    $paymentTerm->fillForUpdate($data);
    $paymentTerm->logForUpdated();
    DB::commit();
    return redirect()->back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(PaymentTerm $paymentTerm) {
    DB::beginTransaction();
    $paymentTerm->delete();
    $paymentTerm->logForDeleted();
    DB::commit();
    return redirect()->route('paymentTerms.index');
  }
}

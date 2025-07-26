<?php

namespace App\Http\Controllers\Sales;

use App\Models\Core\Country;
use App\Http\Requests\Sales\CustomerRequest;
use App\Services\Sales\CustomerService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\Controller;
use App\Models\Sales\Customer;


class CustomerController extends Controller {
  private CustomerService $customerService;
  /**
   * Display a listing of the resource.
   */
  public function __construct(Request $request, CustomerService $customerService) {
    $this->customerService = $customerService;
    parent::__construct($request, Customer::class);
  }

  public function index(Request $request) {
    $this->setBreadcrumbs();
    Customer::dataTable($request);
    return Inertia::render('Sales/Customers/Index', []);
  }

  public function create() {
    $this->setBreadcrumbs();
    return Inertia::render('Sales/Customers/Show');
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(CustomerRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();
    $data['country_id'] = $data['country']['code'];
    $customer = Customer::create($data);
    $this->customerService->storeBranches($customer, $data["branches"] ?? []);
    $customer->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user created this',
        'id' => ':user membuat ini'
      ]
    ]);
    DB::commit();
    return redirect()->back();
  }
  public function show(Customer $customer) {
    $this->setBreadcrumbs($customer);
    $customer->showDetail();
    return $this->renderShow(
      'Sales/Customers/Show',
      "customer",
      $customer->name,
      $customer
    );
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function update(CustomerRequest $request, Customer $customer) {
    $data = $request->validated();
    DB::beginTransaction();
    $data['country_id'] = $data['country']['code'];
    $customer->update($data);
    $this->customerService->storeBranches($customer, $data["branches"] ?? []);
    $customer->logs()->create([
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
  public function destroy(Request $request) {
  }
}

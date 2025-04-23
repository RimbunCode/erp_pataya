<?php

namespace App\Http\Controllers\Sales;

use App\Http\Requests\Sales\StoreCustomerRequest;
use App\Http\Requests\Sales\UpdateCustomerRequest;
use App\Models\Core\Country;
use App\Http\Requests\Sales\CustomerRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\Controller;
use App\Models\Sales\Customer;


class CustomerController extends Controller
{
  /**
   * Display a listing of the resource.
   */
  public function __construct(Request $request)
  {
    parent::__construct($request, Customer::class);
  }

  public function index(Request $request)
  {
    $this->setBreadcrumbs();
    Customer::dataTable($request);
    return Inertia::render('Sales/Customers/Index', [
      'countries' => Inertia::defer(fn() => Country::all())
    ]);
  }

  public function create()
  {
    $this->setBreadcrumbs("__(sales.customer.new)");
    return Inertia::render('Sales/Customers/Show');
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(CustomerRequest $request)
  {
    $data = $request->validated();
    DB::beginTransaction();
    $customer = Customer::create($data);
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
  public function show(Request $request, Customer $customer)
  {

    $this->setBreadcrumbs($customer);
    $customer->showDetail();
    return Inertia::render('Sales/Customers/Show', [
      'customer' => fn() => $customer,
      'countries' => Inertia::defer(fn() => Country::all())
    ]);
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function update(CustomerRequest $request, Customer $customer)
  {
    $data = $request->validated();
    DB::beginTransaction();
    $customer->update($data);
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
  public function destroy(Request $request): RedirectResponse
  {
    $request->validate([
      'password' => ['required', 'current_password'],
    ]);

    $user = $request->user();

    Auth::logout();

    $user->delete();

    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return Redirect::to('/');
  }
}

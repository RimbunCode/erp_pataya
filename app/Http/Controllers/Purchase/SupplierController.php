<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Models\Purchase\Supplier;
use App\Http\Requests\Purchase\SupplierRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\Auth;


class SupplierController extends Controller
{
  public function __construct(Request $request)
  {
    parent::__construct($request, Supplier::class);
  }
  /**
   * Display a listing of the resource.
   */
  public function index(Request $request)
  {
    $this->setBreadcrumbs();
    Supplier::dataTable($request);
    return Inertia::render('Purchase/Suppliers/Index',);
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create()
  {
    $this->setBreadcrumbs("__(purchase.supplier.new)");
    return Inertia::render('Purchases/Suppliers/Show');
  }

  public function store(SupplierRequest $request)
  {
    $data = $request->validated();
    DB::beginTransaction();
    $supplier = Supplier::create([
      'name' => $data['name'],
      'email' => $data['email'],
      'phones' => $data['phones'],
      'banks' => $data['banks'] ?? '',
      'street' => $data['street'],
      'city' => $data['city'],
      'province' => $data['province'],
      'zip_code' => $data['zip_code'],
      'country' => $data['country'],
    ]);
    DB::commit();
    return redirect()->route('suppliers.show', $supplier);
  }

  public function show(Request $request, Supplier $supplier)
  {
    $this->setBreadcrumbs($supplier);
    $supplier->showDetail();
    return Inertia::render('Purchases/Suppliers/Show', [
      'supplier' => $supplier,
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

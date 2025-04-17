<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Models\Core\Country;
use App\Models\Purchase\Supplier;
use App\Http\Requests\Purchase\SupplierRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\Auth;


class SupplierController extends Controller {
  public function __construct(Request $request) {
    parent::__construct($request, Supplier::class);
  }
  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    Supplier::dataTable($request);
    return Inertia::render('Purchase/Suppliers/Index');
  }

  /**
   * Show the form for creating a new resource.
   */
  public function create() {
    $this->setBreadcrumbs("__(purchase.supplier.new)");
    return Inertia::render('Purchase/Suppliers/Show');
  }

  public function store(SupplierRequest $request) {
    $data = $request->validated();
    DB::beginTransaction();
    if (isset($data['country'])) {
      $data['country_id'] = $data['country']['code'];
    }
    $supplier = Supplier::create($data);
    $supplier->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user created this',
        'id' => ':user membuat ini'
      ]
    ]);
    DB::commit();
    return redirect()->back();
  }

  public function show(Request $request, Supplier $supplier) {

    $this->setBreadcrumbs($supplier);
    $supplier->showDetail();
    $supplier->load('country');
    return Inertia::render('Purchase/Suppliers/Show', [
      'supplier' => fn() => $supplier,
    ]);
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function update(SupplierRequest $request, Supplier $supplier) {
    $data = $request->validated();
    DB::beginTransaction();
    if (isset($data['country'])) {
      $data['country_id'] = $data['country']['code'];
    }
    $supplier->update($data);
    $supplier->logs()->create([
      'user_id' => $request->user()->id,
      'activity' => [
        'en' => ':user updated this',
        'id' => ':user memperbarui ini'
      ]
    ]);
    DB::commit();
    return back();
  }

  public function destroy(Request $request): RedirectResponse {
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

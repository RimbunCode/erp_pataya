<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Branch;
use App\Models\Core\Currency;
use App\Models\Core\Preference;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class CompanyController extends Controller {
  /**
   * Display a listing of the resource.
   */
  public function index() {
    $preferences = Preference::get(['key', 'value']);
    $preferences = $preferences->mapWithKeys(fn($pref) => [$pref->key => $pref->value]);
    return Inertia::render('Settings/Company', [
      'preferences' => $preferences->toArray(),
      'currencies' => fn() => Currency::all()->toArray(),
      'breadcrumbs' => [
        ['name' => 'Company Details'],
      ],
    ]);
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(Request $request) {
    $preferences = $request->all();
    DB::beginTransaction();
    foreach ($preferences as $key => $value) {
      Preference::updateOrCreate(['key' => $key], ['value' => $value]);
    }
    Branch::updateOrCreate(
      [
        'branchable_id' => null,
        'branchable_type' => null,
        'is_main_branch' => true,
      ],
      [
        'name' => $preferences['company_name'] ?? '',
        'email' => $preferences['email'] ?? '',
        'phone' => $preferences['phone'] ?? '',
        'billing_street' => $preferences['street'] ?? '',
        'billing_city' => $preferences['city'] ?? '',
        'billing_state' => $preferences['state'] ?? '',
        'billing_zip' => $preferences['zip_code'] ?? '',
        'billing_country' => $preferences['country'] ?? '',
        'shipping_street' => $preferences['street'] ?? '',
        'shipping_city' => $preferences['city'] ?? '',
        'shipping_state' => $preferences['state'] ?? '',
        'shipping_zip' => $preferences['zip_code'] ?? '',
        'shipping_country' => $preferences['country'] ?? '',
      ]
    );
    DB::commit();
    return back();
  }
}

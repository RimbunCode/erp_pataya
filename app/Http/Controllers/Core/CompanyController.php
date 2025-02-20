<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
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
    DB::commit();
    return back();
  }
}

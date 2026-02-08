<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\Currency;
use App\Models\Core\File;
use App\Models\Core\Preference;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CompanyController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $oriPreferences = Preference::get(['key', 'value']);
        $preferences = $oriPreferences->mapWithKeys(fn ($pref) => [$pref->key => $pref->value]);

        return Inertia::render('Settings/Company', [
            'company' => $preferences->toArray(),
            'currencies' => Inertia::defer(function () {
                return Currency::all()->toArray();
            }),
            'countries' => Inertia::defer(function () {
                return Country::all();
            }),
            'breadcrumbs' => [
                ['name' => 'Company Details'],
            ],
            'timezones' => timezone_identifiers_list(),
        ]);
    }

    public function update(Request $request)
    {
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
                'billing_zip_code' => $preferences['zip_code'] ?? '',
                'billing_country' => $preferences['country_id'] ?? '',
                'shipping_street' => $preferences['street'] ?? '',
                'shipping_city' => $preferences['city'] ?? '',
                'shipping_state' => $preferences['state'] ?? '',
                'shipping_zip_code' => $preferences['zip_code'] ?? '',
                'shipping_country' => $preferences['country_id'] ?? '',
            ],
        );
        DB::commit();

        return back();
    }

    public function image(Request $request)
    {
        DB::beginTransaction();
        File::uploadFile($request, 'Company', function ($file) {
            Preference::updateOrCreate(['key' => 'company_image'], ['value' => $file->id]);
        });
        DB::commit();

        return back();
    }
}

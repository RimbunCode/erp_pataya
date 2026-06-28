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

class CompanyController extends Controller {
    protected function enforcePermission($method) {
        if ($method == 'image') {
            return 'write';
        }
    }

    /**
     * Display a listing of the resource.
     */
    public function index() {
        $oriPreferences = Preference::withoutGlobalScope(Preference::HIDE_PRIVATE_KEYS_SCOPE)
            ->get(['key', 'value']);
        $preferences = $oriPreferences->mapWithKeys(fn ($pref) => [$pref->key => $pref->value]);

        $company = $preferences->toArray();

        // Resolve LinkModel object untuk field yang butuh object di FE.
        if (! empty($company['default_currency_id'])) {
            $company['default_currency_id'] = Currency::find(strtoupper($company['default_currency_id']));
        }
        if (! empty($company['country_id'])) {
            $company['country_id'] = Country::find(strtoupper($company['country_id']));
        }

        return Inertia::render('Settings/Company', [
            'model'       => Preference::class,
            'company'     => $company,
            'breadcrumbs' => [
                ['name' => 'Company Details'],
            ],
            'timezones' => timezone_identifiers_list(),
        ]);
    }

    public function update(Request $request) {
        $preferences = $request->all();

        // FE mengirim LinkModel fields sebagai object payload {code, name, ...} atau string code.
        // Ekstrak code dan simpan uppercase sebagai Preference value.
        foreach (['default_currency_id', 'country_id'] as $codeField) {
            if (array_key_exists($codeField, $preferences)) {
                $raw                     = $preferences[$codeField];
                $preferences[$codeField] = strtoupper(
                    is_array($raw) ? ($raw['code'] ?? '') : (string) $raw,
                );
            }
        }

        DB::beginTransaction();
        foreach ($preferences as $key => $value) {
            Preference::withoutGlobalScope(Preference::HIDE_PRIVATE_KEYS_SCOPE)
                ->updateOrCreate(['key' => $key], ['value' => $value]);
        }
        // Derive aplikasi-wide number format dari currency default terpilih.
        if (isset($preferences['default_currency_id'])) {
            $currency = Currency::find($preferences['default_currency_id']);
            Preference::withoutGlobalScope(Preference::HIDE_PRIVATE_KEYS_SCOPE)
                ->updateOrCreate(
                    ['key' => 'default_number_format'],
                    ['value' => $currency?->number_format ?? '#,###.##'],
                );
        }
        Branch::updateOrCreate(
            [
                'branchable_id'   => null,
                'branchable_type' => null,
                'is_main_branch'  => true,
            ],
            [
                'name'              => $preferences['company_name'] ?? '',
                'email'             => $preferences['email'] ?? '',
                'phone'             => $preferences['phone'] ?? '',
                'billing_street'    => $preferences['street'] ?? '',
                'billing_city'      => $preferences['city'] ?? '',
                'billing_state'     => $preferences['state'] ?? '',
                'billing_zip_code'  => $preferences['zip_code'] ?? '',
                'billing_country'   => $preferences['country_id'] ?? '',
                'shipping_street'   => $preferences['street'] ?? '',
                'shipping_city'     => $preferences['city'] ?? '',
                'shipping_state'    => $preferences['state'] ?? '',
                'shipping_zip_code' => $preferences['zip_code'] ?? '',
                'shipping_country'  => $preferences['country_id'] ?? '',
            ],
        );
        DB::commit();

        return back();
    }

    public function image(Request $request) {
        DB::beginTransaction();
        File::uploadFile($request, 'Company', function ($file) {
            Preference::withoutGlobalScope(Preference::HIDE_PRIVATE_KEYS_SCOPE)
                ->updateOrCreate(['key' => 'company_image'], ['value' => $file->id]);
        }, [
            'is_public' => true,
        ]);
        DB::commit();

        return back();
    }
}

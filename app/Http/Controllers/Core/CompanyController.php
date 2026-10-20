<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Branch;
use App\Models\Core\CoreSetting;
use App\Models\Core\Country;
use App\Models\Core\Currency;
use App\Models\Core\File;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, CoreSetting::class);
    }

    protected function exceptPermission(string $method): bool {
        return $method === 'index';
    }

    protected function enforcePermission(string $method): ?string {
        if (\in_array($method, ['image', 'removeImage'])) {
            return 'write';
        }

        return null;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(SettingsService $settingsService): Response {
        $this->guard('read');
        $setting                  = $settingsService->get(CoreSetting::class);
        $fields                   = array_filter(array_keys(CoreSetting::rules()), fn (string $field): bool => ! str_contains($field, '.'));
        $company                  = $setting->only(array_diff($fields, ['mail_password']));
        $company['mail_password'] = null;
        $company['company_image'] = $setting->company_image_id;

        // Resolve LinkModel object untuk field yang butuh object di FE.
        if (! empty($company['default_currency_id'])) {
            $company['default_currency_id'] = Currency::find($company['default_currency_id']);
        }
        if (! empty($company['country_id'])) {
            $company['country_id'] = Country::find($company['country_id']);
        }

        return Inertia::render('Settings/Company', [
            'model'       => CoreSetting::class,
            'company'     => $company,
            'breadcrumbs' => [
                ['name' => 'Company Details'],
            ],
            'timezones' => timezone_identifiers_list(),
        ]);
    }

    public function update(Request $request, SettingsService $settings): RedirectResponse {
        DB::transaction(function () use ($request, $settings): void {
            $allowedFields = array_filter(array_keys(CoreSetting::rules()), fn (string $field): bool => ! str_contains($field, '.'));

            // Fail closed seperti SettingsService: kunci asing ditolak 422,
            // bukan dibuang diam-diam. onlyCreator disuntik konstruktor induk
            // (Controller::__construct) untuk DataTableScope, bukan input user.
            $unknown = array_diff(array_keys($request->all()), $allowedFields, ['_token', '_method', 'onlyCreator']);
            if ($unknown !== []) {
                throw ValidationException::withMessages(array_fill_keys($unknown, __('validation.prohibited')));
            }

            $attributes = $request->only($allowedFields);
            if (array_key_exists('mail_password', $attributes) && ($attributes['mail_password'] === null || $attributes['mail_password'] === '')) {
                unset($attributes['mail_password']);
            }
            $company = $settings->update(CoreSetting::class, $attributes);
            Branch::updateOrCreate(
                [
                    'branchable_id'   => null,
                    'branchable_type' => null,
                    'is_main_branch'  => true,
                ],
                [
                    'name'                => $company->company_name ?? '',
                    'billing_street'      => $company->street ?? '',
                    'billing_city'        => $company->city ?? '',
                    'billing_state'       => $company->state ?? '',
                    'billing_zip_code'    => $company->zip_code ?? '',
                    'billing_country_id'  => $company->country_id,
                    'shipping_street'     => $company->street ?? '',
                    'shipping_city'       => $company->city ?? '',
                    'shipping_state'      => $company->state ?? '',
                    'shipping_zip_code'   => $company->zip_code ?? '',
                    'shipping_country_id' => $company->country_id,
                ],
            );
        });

        return back();
    }

    public function image(Request $request, SettingsService $settings): RedirectResponse {
        DB::transaction(function () use ($request, $settings): void {
            File::uploadFile($request, 'Company', function (File $file) use ($settings): void {
                $settings->update(CoreSetting::class, ['company_image_id' => $file->id]);
            }, ['is_public' => true]);
        });

        return back();
    }

    public function removeImage(SettingsService $settings): RedirectResponse {
        $settings->update(CoreSetting::class, [
            'company_image_id' => null,
        ]);

        return back();
    }
}

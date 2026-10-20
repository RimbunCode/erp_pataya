<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoreSetting extends ModuleSetting {
    use HasFactory;

    public string $translateKey           = 'core.setting';
    protected static array $auditRedacted = ['bank_account_number', 'mail_password'];
    protected $hidden                     = ['mail_password'];

    protected function casts(): array {
        return [
            'singleton'        => 'boolean',
            'num_per_page'     => 'integer',
            'per_page_options' => 'array',
            'mail_port'        => 'integer',
            'mail_password'    => 'encrypted',
        ];
    }

    protected static function defaults(): array {
        return [
            'default_number_format' => '#.###,##',
            'timezone'              => 'Asia/Jakarta',
            'num_per_page'          => 25,
            'per_page_options'      => [25, 50, 100],
        ];
    }

    public static function rules(): array {
        return [
            'company_name'          => ['nullable', 'string', 'max:255'],
            'short_name'            => ['nullable', 'string', 'max:50'],
            'email'                 => ['nullable', 'email', 'max:255'],
            'phone'                 => ['nullable', 'string', 'max:50'],
            'street'                => ['nullable', 'string'],
            'city'                  => ['nullable', 'string', 'max:100'],
            'state'                 => ['nullable', 'string', 'max:100'],
            'zip_code'              => ['nullable', 'string', 'max:20'],
            'country_id'            => ['nullable', 'string', 'max:2', 'exists:countries,code'],
            'bank_name'             => ['nullable', 'string', 'max:255'],
            'bank_account_name'     => ['nullable', 'string', 'max:255'],
            'bank_account_number'   => ['nullable', 'string', 'max:100'],
            'default_currency_id'   => ['nullable', 'string', 'max:10', 'exists:currencies,code'],
            'default_number_format' => ['nullable', 'string', 'max:50'],
            'timezone'              => ['required', 'string', 'timezone:all'],
            'num_per_page'          => ['required', 'integer', 'min:1'],
            'per_page_options'      => ['nullable', 'array'],
            'per_page_options.*'    => ['integer', 'min:1'],
            'company_image_id'      => ['nullable', 'ulid', 'exists:files,id'],
            'mail_protocol'         => ['nullable', 'in:smtp'],
            'mail_encryption'       => ['nullable', 'string', 'max:255'],
            'mail_host'             => ['nullable', 'string', 'max:255'],
            'mail_port'             => ['nullable', 'integer', 'between:1,65535'],
            'mail_username'         => ['nullable', 'string', 'max:255'],
            'mail_password'         => ['nullable', 'string', 'max:4096'],
            'mail_from_address'     => ['nullable', 'email', 'max:255'],
            'mail_from_name'        => ['nullable', 'string', 'max:255'],
        ];
    }

    public function country(): BelongsTo {
        return $this->belongsTo(Country::class, 'country_id', 'code');
    }

    public function defaultCurrency(): BelongsTo {
        return $this->belongsTo(Currency::class, 'default_currency_id', 'code');
    }

    public function companyImage(): BelongsTo {
        return $this->belongsTo(File::class, 'company_image_id', 'id');
    }
}

<?php

namespace App\Models\Asset;

use App\Models\Core\ModuleSetting;
use Database\Factories\Asset\AssetSettingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Validation\Rule;

class AssetSetting extends ModuleSetting {
    /** @use HasFactory<AssetSettingFactory> */
    use HasFactory;

    /**
     * Kunci yang dikenali DepreciationMethodFactory; satu-satunya sumber opsi metode.
     *
     * @var list<string>
     */
    public const DEPRECIATION_METHODS = [
        'straight_line',
        'double_declining_balance',
        'written_down_value',
        'manual',
    ];

    public string $translateKey = 'asset.setting';

    // Modul Permission khusus agar profil peran tidak membuka halaman ini bagi non-admin.
    protected static ?string $permissionModule = 'Setting';

    protected function casts(): array {
        return [
            'singleton'                             => 'boolean',
            'default_frequency_of_depreciation'     => 'integer',
            'default_total_number_of_depreciations' => 'integer',
        ];
    }

    protected static function defaults(): array {
        return [
            'default_depreciation_method'           => null,
            'default_frequency_of_depreciation'     => null,
            'default_total_number_of_depreciations' => null,
        ];
    }

    public static function rules(): array {
        return [
            'default_depreciation_method'           => ['nullable', 'string', Rule::in(self::DEPRECIATION_METHODS)],
            'default_frequency_of_depreciation'     => ['nullable', 'integer', 'min:1'],
            'default_total_number_of_depreciations' => ['nullable', 'integer', 'min:1'],
        ];
    }
}

<?php

namespace App\Models\Sales;

use App\Models\Core\ModuleSetting;
use App\Models\Finances\Tax;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesSetting extends ModuleSetting {
    use HasFactory;

    public string $translateKey = 'sales.setting';

    // Dedicated module so role profiles in AdministratorSeeder cannot
    // implicitly open this page to non-admin roles (Requirement 9.4).
    // Access is granted explicitly in ModuleSettingPermissionSeeder.
    protected static ?string $permissionModule = 'Setting';

    protected function casts(): array {
        return [
            'singleton' => 'boolean',
        ];
    }

    protected static function defaults(): array {
        return [];
    }

    public static function rules(): array {
        return [
            'default_tax_id' => ['nullable', 'ulid', 'exists:taxes,id'],
        ];
    }

    public function defaultTax(): BelongsTo {
        return $this->belongsTo(Tax::class, 'default_tax_id');
    }
}

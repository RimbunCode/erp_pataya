<?php

namespace App\Models\Sales;

use App\Models\Core\ModuleSetting;
use App\Models\Finances\PaymentTermTemplate;
use App\Models\Finances\Tax;
use App\Models\Inventory\Warehouse;
use App\Rules\ExistsExcludingTrashed;
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
            'singleton'                       => 'boolean',
            'over_delivery_tolerance_percent' => 'float',
            'over_billing_tolerance_percent'  => 'float',
            'quotation_validity_days'         => 'integer',
        ];
    }

    protected static function defaults(): array {
        return [
            'default_tax_id'                   => null,
            'default_source_warehouse_id'      => null,
            'default_payment_term_template_id' => null,
            'over_delivery_tolerance_percent'  => null,
            'over_billing_tolerance_percent'   => null,
            'rate_change_action'               => 'none',
            'below_cost_action'                => 'none',
            'quotation_validity_days'          => null,
        ];
    }

    public static function rules(): array {
        return [
            'default_tax_id'                   => ['nullable', 'ulid', new ExistsExcludingTrashed('taxes')],
            'default_source_warehouse_id'      => ['nullable', 'ulid', new ExistsExcludingTrashed('warehouses')],
            'default_payment_term_template_id' => ['nullable', 'ulid', new ExistsExcludingTrashed('payment_term_templates')],
            'over_delivery_tolerance_percent'  => ['nullable', 'numeric', 'between:0,100'],
            'over_billing_tolerance_percent'   => ['nullable', 'numeric', 'between:0,100'],
            'rate_change_action'               => ['required', 'in:none,warn,stop'],
            'below_cost_action'                => ['required', 'in:none,warn,stop'],
            'quotation_validity_days'          => ['nullable', 'integer', 'min:0', 'max:65535'],
        ];
    }

    public function defaultTax(): BelongsTo {
        return $this->belongsTo(Tax::class, 'default_tax_id');
    }

    public function defaultSourceWarehouse(): BelongsTo {
        return $this->belongsTo(Warehouse::class, 'default_source_warehouse_id');
    }

    public function defaultPaymentTermTemplate(): BelongsTo {
        return $this->belongsTo(PaymentTermTemplate::class, 'default_payment_term_template_id');
    }
}

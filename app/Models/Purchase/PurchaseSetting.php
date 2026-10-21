<?php

namespace App\Models\Purchase;

use App\Models\Core\ModuleSetting;
use App\Models\Finances\PaymentTermTemplate;
use App\Models\Finances\Tax;
use App\Models\Inventory\Warehouse;
use App\Rules\ExistsExcludingTrashed;
use Database\Factories\Purchase\PurchaseSettingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseSetting extends ModuleSetting {
    /** @use HasFactory<PurchaseSettingFactory> */
    use HasFactory;

    public string $translateKey                = 'purchase.setting';
    protected static ?string $permissionModule = 'Setting';

    protected function casts(): array {
        return [
            'singleton'                      => 'boolean',
            'over_receipt_tolerance_percent' => 'float',
            'over_billing_tolerance_percent' => 'float',
        ];
    }

    protected static function defaults(): array {
        return [
            'default_tax_id'                   => null,
            'default_target_warehouse_id'      => null,
            'default_payment_term_template_id' => null,
            'over_receipt_tolerance_percent'   => null,
            'over_billing_tolerance_percent'   => null,
            'rate_change_action'               => 'none',
        ];
    }

    public static function rules(): array {
        return [
            'default_tax_id'                   => ['nullable', 'ulid', new ExistsExcludingTrashed('taxes')],
            'default_target_warehouse_id'      => ['nullable', 'ulid', new ExistsExcludingTrashed('warehouses')],
            'default_payment_term_template_id' => ['nullable', 'ulid', new ExistsExcludingTrashed('payment_term_templates')],
            'over_receipt_tolerance_percent'   => ['nullable', 'numeric', 'between:0,100'],
            'over_billing_tolerance_percent'   => ['nullable', 'numeric', 'between:0,100'],
            'rate_change_action'               => ['required', 'in:none,warn,stop'],
        ];
    }

    public function defaultTax(): BelongsTo {
        return $this->belongsTo(Tax::class, 'default_tax_id');
    }

    public function defaultTargetWarehouse(): BelongsTo {
        return $this->belongsTo(Warehouse::class, 'default_target_warehouse_id');
    }

    public function defaultPaymentTermTemplate(): BelongsTo {
        return $this->belongsTo(PaymentTermTemplate::class, 'default_payment_term_template_id');
    }
}

<?php

namespace App\Models\Inventory;

use App\Models\Core\ModuleSetting;
use App\Rules\ExistsExcludingTrashed;
use Database\Factories\Inventory\InventorySettingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventorySetting extends ModuleSetting {
    /** @use HasFactory<InventorySettingFactory> */
    use HasFactory;

    public string $translateKey                = 'inventory.setting';
    protected static ?string $permissionModule = 'Setting';

    protected function casts(): array {
        return [
            'singleton' => 'boolean',
        ];
    }

    protected static function defaults(): array {
        return [
            'default_warehouse_id' => null,
        ];
    }

    public static function rules(): array {
        return [
            'default_warehouse_id' => ['nullable', 'ulid', new ExistsExcludingTrashed('warehouses')],
        ];
    }

    public function defaultWarehouse(): BelongsTo {
        return $this->belongsTo(Warehouse::class, 'default_warehouse_id');
    }
}

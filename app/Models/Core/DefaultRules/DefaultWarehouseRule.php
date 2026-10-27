<?php

namespace App\Models\Core\DefaultRules;

use App\Models\Inventory\Category;
use App\Models\Inventory\Warehouse;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DefaultWarehouseRule extends AuditableDefaultRule {
    protected $table = 'default_warehouse_rules';

    public function warehouse(): BelongsTo {
        return $this->belongsTo(Warehouse::class);
    }

    public function itemCategory(): BelongsTo {
        return $this->belongsTo(Category::class, 'item_category_id');
    }
}

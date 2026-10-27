<?php

namespace App\Models\Core\DefaultRules;

use App\Models\Finances\Tax;
use App\Models\Inventory\Category;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DefaultTaxRule extends AuditableDefaultRule {
    protected $table = 'default_tax_rules';

    public function tax(): BelongsTo {
        return $this->belongsTo(Tax::class);
    }

    public function itemCategory(): BelongsTo {
        return $this->belongsTo(Category::class, 'item_category_id');
    }
}

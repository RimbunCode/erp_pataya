<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\Pivot;

class DeskMenuItem extends Pivot {
    use HasUlids;

    /**
     * MenuItem asli yang direpresentasikan baris ini — null berarti baris
     * ini grup virtual (label/icon custom, tanpa route/model, murni wadah
     * pengelompokan per-desk).
     */
    public function menuItem(): BelongsTo {
        return $this->belongsTo(MenuItem::class);
    }

    /**
     * Parent DI PIVOT INI (bukan menu_items.parent_id) — nesting per-desk
     * yang independen dari hierarki MenuItem global.
     */
    public function parent(): BelongsTo {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany {
        return $this->hasMany(self::class, 'parent_id')->orderBy('order');
    }
}

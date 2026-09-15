<?php

namespace App\Models\Core;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class MenuItem extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'visibility_permission' => 'array',
    ];

    public static function templateLink() {
        return ':label';
    }

    public function parent() {
        return $this->belongsTo(MenuItem::class, 'parent_id');
    }

    public function children() {
        return $this->hasMany(MenuItem::class, 'parent_id')->orderBy('order');
    }

    public function primaryDesk() {
        return $this->belongsTo(Desk::class, 'primary_desk_id');
    }

    public function desks() {
        return $this->belongsToMany(Desk::class, 'desk_menu_item')
            ->using(DeskMenuItem::class)
            ->withPivot(['order', 'icon']);
    }

    /**
     * Cari MenuItem yang route_name-nya cocok dengan $routeName — exact match
     * diprioritaskan, baru wildcard match (`*`, mis. `users.*`, `*.categories.*`)
     * via fnmatch(). WHERE beberapa pola wildcard sama-sama cocok, dipilih yang
     * PALING SPESIFIK (jumlah karakter literal terbanyak) — Requirement 4 AC 4.
     */
    public static function forRoute(string $routeName): ?self {
        $exact = static::where('route_name', $routeName)->first();
        if ($exact) {
            return $exact;
        }

        return static::query()
            ->where('route_name', 'like', '%*%')
            ->get()
            ->filter(fn (self $item) => fnmatch($item->route_name, $routeName))
            ->sortByDesc(fn (self $item) => \strlen(str_replace('*', '', $item->route_name)))
            ->first();
    }
}

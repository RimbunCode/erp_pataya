<?php

namespace App\Models\Core;

use App\Enums\DeskType;
use App\Enums\Domain;
use App\Events\Core\DeskDeleted;
use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Desk extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes;

    protected $guarded           = ['id'];
    public string $keyBreadcrumb = 'name';
    public string $translateKey  = 'core.desk';
    public string $route         = 'desks';

    protected static function booted(): void {
        static::deleting(function (Desk $desk) {
            DeskDeleted::dispatch($desk);
        });
    }

    protected function casts(): array {
        return [
            'type'             => DeskType::class,
            'domain'           => Domain::class,
            'is_personal_only' => 'boolean',
            'is_shared_all'    => 'boolean',
            'is_disabled'      => 'boolean',
        ];
    }

    protected array $configColumns = [
        'name' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'domain' => [
            'show'  => true,
            'order' => 1,
        ],
        'type' => [
            'show'  => true,
            'order' => 2,
        ],
    ];

    public function menuItems() {
        return $this->belongsToMany(MenuItem::class, 'desk_menu_item')
            ->using(DeskMenuItem::class)
            ->withPivot(['order', 'icon'])
            ->orderByPivot('order');
    }

    /**
     * Akses langsung ke baris pivot desk_menu_item — beda dari menuItems()
     * (belongsToMany flat ke MenuItem), method ini expose kolom pivot
     * (label, parent_id, menu_item_id nullable) yang dibutuhkan untuk
     * grup virtual + nesting custom per-desk.
     */
    public function menuItemPivots(): HasMany {
        return $this->hasMany(DeskMenuItem::class)->orderBy('order');
    }

    public function owner() {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function dashboard() {
        return $this->belongsTo(Dashboard::class);
    }

    /**
     * Resolve dashboard Desk ini, membuat Dashboard kosong bila belum ada
     * (Requirement 7 AC 2) — dipanggil eksplisit oleh Controller, BUKAN
     * side-effect otomatis pada akses relasi dashboard() biasa.
     */
    public function resolveDashboard(): Dashboard {
        if ($this->dashboard) {
            return $this->dashboard;
        }

        $dashboard = Dashboard::create(['title' => "{$this->name} Dashboard"]);
        $this->update(['dashboard_id' => $dashboard->id]);

        return $dashboard;
    }

    public function assignables(): HasMany {
        return $this->hasMany(DeskAssignable::class);
    }

    public function userPreferences(): HasMany {
        return $this->hasMany(DeskUserPreference::class);
    }
}

<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Traits\DataTable;
use Database\Factories\SavedFilterFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavedFilter extends Model {
    use DataTable, HasFactory, HasUlids;

    protected $guarded = ['id'];

    // Dipakai initPermissions() (trait DataTable) -> Permission.name = Str::plural($alias).
    public static string $alias = 'Filter Template';
    public string $translateKey = 'core.filterTemplate';

    // Kolom listing Filter Templates (halaman admin). Filter privat/ephemeral
    // tidak pernah lewat halaman ini (dibatasi scopeSharedListing), jadi kolom
    // is_shared/is_saved tidak perlu ditampilkan.
    protected array $configColumns = [
        'name' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'model' => [
            'show'  => true,
            'order' => 1,
        ],
        'user' => [
            'show'  => true,
            'order' => 2,
        ],
        'is_default' => [
            'show'  => true,
            'order' => 3,
        ],
        'updated_at' => [
            'show'  => true,
            'order' => 4,
        ],
        'filter' => [
            'ignore' => true,
        ],
        'sort' => [
            'ignore' => true,
        ],
        'is_shared' => [
            'ignore' => true,
        ],
        'is_saved' => [
            'ignore' => true,
        ],
    ];

    protected static function newFactory(): Factory {
        return SavedFilterFactory::new();
    }

    protected function casts(): array {
        return [
            'filter'     => 'array',
            'is_saved'   => 'boolean',
            'is_shared'  => 'boolean',
            'is_default' => 'boolean',
        ];
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    /**
     * Relasi ke Permission berdasar kecocokan `model` (FQCN) — BUKAN FK id
     * standar, karena `saved_filters.model` sudah string FQCN sejak awal
     * (bukan `permission_id`). Dipakai FE (PermissionLinkModel picker) untuk
     * menampilkan model target saat edit.
     */
    public function permission(): BelongsTo {
        return $this->belongsTo(Permission::class, 'model', 'model');
    }

    protected static function loadRelationsOnShow() {
        return ['permission'];
    }

    /**
     * Nama route resource ('filterTemplate') BEDA dari nama class ('SavedFilter')
     * — override ini supaya breadcrumb (Controller::setBreadcrumbs) dan metadata
     * link kolom (DataTableScope::addDataTable, dikonsumsi DataTable2.jsx) mengarah
     * ke route filterTemplates.* yang benar-benar terdaftar. Pola sama persis
     * StockLedgerEntry::getNameClass() (app/Models/Inventory/StockLedgerEntry.php).
     * CATATAN: initPermissions() TIDAK memakai method ini (pakai nama class
     * mentah langsung), jadi kolom `permissions.route` akan tetap 'savedFilters'
     * — sama seperti StockLedgerEntry, dan tidak ada consumer runtime yang baca
     * kolom itu.
     */
    public function getNameClass() {
        return 'filterTemplate';
    }

    /**
     * Scope ke model tertentu (FQCN).
     */
    public function scopeForModel(Builder $query, string $model): Builder {
        return $query->where('model', $model);
    }

    /**
     * Listing private: named filter milik user untuk sebuah model.
     */
    public function scopeOwnedListing(Builder $query, string $userId, string $model): Builder {
        return $query->where('is_saved', true)
            ->where('user_id', $userId)
            ->where('model', $model);
    }

    /**
     * Listing gabungan private+shared untuk dropdown filter di list page:
     * named filter milik user sendiri ATAU shared filter untuk model tsb.
     */
    public function scopeVisibleTo(Builder $query, string $userId, string $model): Builder {
        return $query->where('is_saved', true)
            ->where('model', $model)
            ->where(fn (Builder $q) => $q->where('user_id', $userId)->orWhere('is_shared', true));
    }

    /**
     * Listing admin (Filter Templates): semua shared filter, lintas model bila
     * $model null.
     */
    public function scopeSharedListing(Builder $query, ?string $model = null): Builder {
        $query->where('is_shared', true);

        return $model ? $query->where('model', $model) : $query;
    }

    /**
     * Shared filter yang jadi default untuk sebuah model (maksimal satu).
     */
    public function scopeDefaultFor(Builder $query, string $model): Builder {
        return $query->where('model', $model)
            ->where('is_shared', true)
            ->where('is_default', true);
    }
}

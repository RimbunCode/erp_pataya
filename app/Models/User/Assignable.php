<?php

namespace App\Models\User;

use App\Models\Model;
use Illuminate\Database\Eloquent\Builder;

class Assignable extends Model {
    protected $table               = 'assignables';
    public $timestamps             = false;
    public $incrementing           = false;
    protected $keyType             = 'string';
    protected array $configColumns = [
        'deleted_at' => [
            'ignore' => true,
        ],
    ];

    public static function templateLink() {
        return '<title>:name (:type)</title><b>:name</b><br/><span>:type</span>';
    }

    /**
     * Query dropdown/picker (LinkModel): sembunyikan user/role yang sudah
     * di-soft-delete. Lookup by-id (nilai tersimpan, mis. Ticket/Todo show)
     * tidak lewat sini — ModelController::__invoke memanggil find() langsung
     * saat request membawa `id`, jadi riwayat tetap ter-resolve walau
     * assignee-nya sudah dihapus.
     */
    public function scopeLinkModel(Builder $query, string $search = ''): Builder {
        return $query->whereNull('deleted_at')
            ->when($search !== '', fn ($q) => $q->where('name', 'like', "%{$search}%"));
    }
}

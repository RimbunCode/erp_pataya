<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Models\User\Assignable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeskAssignable extends Model {
    use HasUlids;

    protected $guarded             = ['id'];
    protected array $configColumns = [
        'desk',
        'assignable',
    ];

    public static function templateLink() {
        return ':desk.name - :assignable';
    }

    public function desk(): BelongsTo {
        return $this->belongsTo(Desk::class);
    }

    /**
     * `assignable_id` -> view `assignables` (union users+roles, lihat
     * Assignable::class) — BUKAN polymorphic Eloquent (tidak butuh kolom
     * *_type utk resolve relasi, cukup FK biasa krn view sudah gabungkan
     * id+type+name). Field `assignable_type` tetap dipertahankan sbg kolom
     * SUMBER OF TRUTH utk logic query (mis. resolveForSafe), relasi ini
     * murni utk kebutuhan tampil (AssignableLinkModel di form Desk).
     */
    public function assignable(): BelongsTo {
        return $this->belongsTo(Assignable::class, 'assignable_id');
    }
}

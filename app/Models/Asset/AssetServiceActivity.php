<?php

namespace App\Models\Asset;

use App\Casts\FormStatusCast;
use App\Models\Core\File;
use App\Models\Model;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetServiceActivity extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    public static $parentRelation = 'assetService';
    protected $guarded            = ['id'];
    protected $casts              = [
        'action_date' => 'datetime',
        'status'      => FormStatusCast::class,
    ];

    /**
     * Requirement 9 AC1 (revisi): status AssetService parent SELALU
     * mengikuti activity dengan action_date TERBESAR — bukan sekadar
     * activity yang barusan disimpan (action_date bisa di-backdate,
     * insertion-order saja tidak cukup merepresentasikan kronologi yang
     * benar). Dipicu create MAUPUN update.
     */
    protected static function booted(): void {
        static::saved(function (self $activity) {
            // reorder() WAJIB -- relasi activities() (AssetService.php) sudah
            // punya default orderBy('action_date')->orderBy('id') ASCENDING
            // (Requirement 6 AC8). orderByDesc() TANPA reorder() cuma NAMBAH
            // clause ORDER BY baru di belakang, tidak meng-override yang
            // sudah ada -- SQL akhirnya tetap urut ASC duluan (ketauan lewat
            // test: activity ber-action_date PALING AWAL yang kepilih, bukan
            // paling akhir).
            $latest = $activity->assetService->activities()
                ->whereNotNull('status')
                ->reorder('action_date', 'desc')
                ->orderByDesc('id')
                ->first();

            if ($latest === null) {
                return;
            }

            $activity->assetService->update(['status' => [$latest->status]]);
        });
    }

    public function assetService(): BelongsTo {
        return $this->belongsTo(AssetService::class);
    }

    public function pic(): BelongsTo {
        return $this->belongsTo(User::class, 'pic_id');
    }

    public function files(): MorphToMany {
        return $this->morphToMany(File::class, 'fileable')
            ->whereNull('fileables.deleted_at');
    }
}

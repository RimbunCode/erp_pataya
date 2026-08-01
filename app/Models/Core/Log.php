<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Casts\LogContent;
use App\Models\Model;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Log extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'activity'     => LogContent::class,
        'data_before'  => Json::class,
        'data_after'   => Json::class,
        'comment_json' => 'array',
        'edited_at'    => 'datetime',
    ];
    protected $with        = ['user'];
    protected $appends     = ['code', 'loggable_type_label', 'activity_text'];
    public bool $canDelete = false;

    public function code(): Attribute {
        return new Attribute(
            get: function () {
                $userName  = $this->user?->name ?? 'System';
                $createdAt = $this->created_at?->format('Y-m-d H:i:s') ?? '-';

                return $userName . ' (' . $createdAt . ')';
            },
        );
    }

    /**
     * `activity` (via LogContent cast) berupa objek {en, id} mentah — dipilih
     * konsumen sesuai locale. Untuk tampilan tabel (di mana konsumennya adalah
     * DataTable2 generik, bukan komponen custom seperti Comments.jsx), pilih
     * string sesuai locale aktif di sini, lalu ganti placeholder ":user" dengan
     * link ke profil pelaku — sama seperti Comments.jsx (baris 312-317), supaya
     * tampilan di halaman index konsisten dengan tampilan di panel Activity.
     */
    public function activityText(): Attribute {
        return Attribute::get(function () {
            $activity = $this->activity;
            if (is_object($activity)) {
                $locale  = app()->getLocale();
                $content = $activity->{$locale} ?? $activity->en ?? null;
            } else {
                $content = $activity;
            }

            if ($content === null) {
                return null;
            }

            $userLabel = $this->user
                ? '<a href="' . route('users.show', $this->user->id) . '" rel="noopener noreferrer" target="_blank">' . e($this->user->name) . '</a>'
                : __('core.form.system');

            return str_replace(':user', $userLabel, $content);
        });
    }

    /**
     * Cache lookup label modul per-request, keyed by loggable_type, supaya
     * halaman index (banyak baris, loggable_type campuran) tidak N+1 query
     * ke tabel permissions.
     */
    private static array $loggableTypeLabelCache = [];

    public function loggableTypeLabel(): Attribute {
        return Attribute::get(function () {
            if (! $this->loggable_type) {
                return null;
            }

            return self::$loggableTypeLabelCache[$this->loggable_type] ??= Permission::where('model', $this->loggable_type)->value('name')
                ?? class_basename($this->loggable_type);
        });
    }

    protected static function permissions(): array {
        return ['select', 'read'];
    }

    public $translateKey           = 'core.log';
    protected array $configColumns = [
        'loggable' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'code' => [
            'show'      => true,
            'isLink'    => true,
            'dependsOn' => ['created_at', 'user.name'],
            'order'     => 1,
        ],
        'action' => [
            'valueTrans' => 'core.log.action.options',
            'show'       => true,
            'order'      => 2,
        ],
        'activity_text' => [
            'type'      => 'html',
            'show'      => true,
            'order'     => 3,
            'dependsOn' => ['activity', 'user.name'],
        ],
        'loggable_type_label' => [
            'show'      => true,
            'order'     => 4,
            'dependsOn' => ['loggable_type'],
        ],
        'type' => [
            'show'  => true,
            'order' => 5,

        ],

        'user' => [
            'show'  => true,
            'order' => 6,
        ],
        'created_at' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 7,
        ],
        'data_before' => [
            'ignore' => true,
        ],
        'data_after' => [
            'ignore' => true,
        ],

    ];
    public $keyBreadcrumb = 'code';

    public function user() {
        return $this->belongsTo(User::class);
    }

    public function loggable() {
        return $this->morphTo('loggable', 'loggable_type', 'loggable_id');
    }
}

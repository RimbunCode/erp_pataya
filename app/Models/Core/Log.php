<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Casts\LogContent;
use App\Models\Model;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Log extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'activity'    => LogContent::class,
        'data_before' => Json::class,
        'data_after'  => Json::class,
    ];
    protected $with    = ['user'];
    protected $appends = ['code'];

    public function code(): Attribute {
        return new Attribute(
            get: function () {
                $userName  = $this->user?->name ?? 'System';
                $createdAt = $this->created_at?->format('Y-m-d H:i:s') ?? '-';

                return $userName . ' (' . $createdAt . ')';
            },
        );
    }

    public $translateKey     = 'core.log';
    protected $configColumns = [
        'activity' => [
            'show'  => true,
            'order' => 1,
        ],
        'type' => [
            'show'  => true,
            'order' => 2,
        ],
        'user',
        'loggable',
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

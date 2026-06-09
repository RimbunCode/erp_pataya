<?php

namespace App\Models\Helpdesk;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tiket extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'start_date' => 'datetime',
        'due_date'   => 'datetime',
        'end_date'   => 'datetime',
    ];
    public static string $alias    = 'Tiket';
    public string $formComponent   = 'Helpdesk/Tikets/Form';
    public string $translateKey    = 'helpdesk.tiket';
    public string $keyBreadcrumb   = 'subject';
    protected array $configColumns = [
        'code' => [
            'show'  => true,
            'order' => 0,
        ],
        'type' => [
            'show'  => true,
            'order' => 1,
        ],
        'subject' => [
            'show'  => true,
            'order' => 2,
        ],
        'status' => [
            'show'  => true,
            'order' => 3,
        ],
        'progress' => [
            'show'  => true,
            'order' => 4,
        ],
        'priority' => [
            'show'  => true,
            'order' => 5,
        ],
        'assign_to' => [
            'show'  => true,
            'order' => 6,
        ],
        'created_by' => [
            'show'  => true,
            'order' => 7,
        ],
        'start_date' => [
            'type'  => 'date',
            'show'  => false,
            'order' => 8,
        ],
        'due_date' => [
            'type'  => 'date',
            'show'  => false,
            'order' => 9,
        ],
    ];

    public function assignTo(): BelongsTo {
        return $this->belongsTo(User::class, 'assign_to_id');
    }

    public function createdBy(): BelongsTo {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function branch(): BelongsTo {
        return $this->belongsTo(Branch::class);
    }

    public function responses(): HasMany {
        return $this->hasMany(TiketResponse::class)->orderByDesc('created_at');
    }
}

<?php

namespace App\Models\Helpdesk;

use App\Casts\FormStatusCast;
use App\Models\Core\Branch;
use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Ticket extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'status'     => FormStatusCast::class,
        'start_date' => 'datetime',
        'due_date'   => 'datetime',
        'end_date'   => 'datetime',
    ];
    public static string $alias                = 'Ticket';
    public string $formComponent               = 'Helpdesk/Tickets/Form';
    public string $translateKey                = 'helpdesk.ticket';
    public string $keyBreadcrumb               = 'subject';
    protected static string $defaultFormatCode = '#@[yy]/@[iiii]';
    protected static $generateCodeSeries       = true;
    protected array $configColumns             = [
        'code' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'type' => [
            'valueTrans' => 'helpdesk.ticket.type.options',
            'show'       => true,
            'order'      => 1,
        ],
        'subject' => [
            'show'  => true,
            'order' => 2,
        ],
        'status' => [
            'valueTrans' => 'helpdesk.ticket.status.options',
            'show'       => true,
            'order'      => 3,
        ],
        'progress' => [
            'show'  => true,
            'order' => 4,
        ],
        'priority' => [
            'valueTrans' => 'helpdesk.ticket.priority.options',
            'show'       => true,
            'order'      => 5,
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
    public bool $canDelete = false;

    public static function templateLink(): string {
        return ':code - :subject';
    }

    protected static function loadRelationsOnShow(): array {
        return ['assignTo', 'createdBy', 'responses.user', 'responses.assignTo'];
    }

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
        return $this->hasMany(TicketResponse::class)->orderByDesc('created_at');
    }
}

<?php

namespace App\Models\Helpdesk;

use App\Casts\FormStatusCast;
use App\Models\Core\Branch;
use App\Models\Model;
use App\Models\User\Assignable;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

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
        'assignTo' => [
            'show'               => true,
            'order'              => 6,
            'disabledNavigation' => true,
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
        'assign_to_type' => [
            'ignore' => true,
        ],
    ];
    public bool $canDelete                  = false;
    protected static bool $ignorePermission = true;

    public static function templateLink(): string {
        return ':code - :subject';
    }

    protected static function loadRelationsOnShow(): array {
        return ['assignTo', 'createdBy', 'responses.user', 'responses.assignTo'];
    }

    public function assignTo(): BelongsTo {
        return $this->belongsTo(Assignable::class, 'assign_to_id');
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

    /**
     * User yang benar-benar ter-assign: bila assign_to_type 'role', fan-out ke
     * seluruh user pemegang role tersebut; bila 'user', kembalikan user itu saja.
     */
    public function assignedUsers(): Collection {
        if ($this->assign_to_type === 'role') {
            return User::whereHas('roles', fn ($q) => $q->where('roles.id', $this->assign_to_id))->get();
        }

        $user = User::find($this->assign_to_id);

        return $user ? collect([$user]) : collect();
    }

    public function scopeAssignedToMe(Builder $query, User $user): Builder {
        $roleIds = $user->roles()->pluck('roles.id');

        return $query->where(function ($q) use ($user, $roleIds) {
            $q->where(['assign_to_type' => 'user', 'assign_to_id' => $user->id])
                ->orWhere(function ($q2) use ($roleIds) {
                    $q2->where('assign_to_type', 'role')->whereIn('assign_to_id', $roleIds);
                });
        });
    }
}

<?php

namespace App\Models\Core;

use App\Enums\TodoType;
use App\Models\Model;
use App\Models\User\Assignable;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

class Todo extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'date'               => 'date',
        'due_date'           => 'datetime',
        'type'               => TodoType::class,
        'reminder_lead_days' => 'array',
    ];
    public static string $alias                = 'ToDo';
    public string $formComponent               = 'Core/Todos/Form';
    public string $translateKey                = 'core.todo';
    public string $keyBreadcrumb               = 'code';
    public bool $canDelete                     = true;
    public bool $skipAttachmentOnCreate        = true;
    protected static string $defaultFormatCode = 'TODO/@[yy]-@[mm]/@[iiii]';
    protected static $generateCodeSeries       = true;
    protected static bool $ignorePermission    = true;
    protected array $configColumns             = [
        'code' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'description' => [
            'show'  => true,
            'order' => 1,
        ],
        'reference' => [
            'show'  => true,
            'order' => 2,
        ],
        'type' => [
            'valueTrans' => 'core.todo.type.options',
            'show'       => true,
            'order'      => 3,
        ],
        'allocatedTo' => [
            'show'               => true,
            'order'              => 4,
            'disabledNavigation' => true,
        ],
        'priority' => [
            'valueTrans' => 'core.todo.priority.options',
            'show'       => true,
            'order'      => 5,
        ],
        'status' => [
            'show'  => true,
            'order' => 6,
        ],
        'date' => [
            'type'  => 'date',
            'show'  => true,
            'order' => 7,
        ],
        'assignedBy' => [
            'show'  => true,
            'order' => 8,
        ],
        'allocated_to_type' => [
            'ignore' => true,
        ],
    ];

    protected static function loadRelationsOnShow(): array {
        return ['reference', 'allocatedTo', 'assignedBy'];
    }

    public function reference(): MorphTo {
        return $this->morphTo('reference', 'reference_type', 'reference_id');
    }

    public function allocatedTo(): BelongsTo {
        return $this->belongsTo(Assignable::class, 'allocated_to_id');
    }

    public function assignedBy(): BelongsTo {
        return $this->belongsTo(User::class, 'assigned_by_id');
    }

    public function reminders(): HasMany {
        return $this->hasMany(TodoReminder::class);
    }

    public function allocatedUsers(): Collection {
        if ($this->allocated_to_type === 'role') {
            return User::whereHas('roles', fn ($q) => $q->where('roles.id', $this->allocated_to_id))->get();
        }

        $user = User::find($this->allocated_to_id);

        return $user ? collect([$user]) : collect();
    }

    public function scopeAssignedToMe($query, User $user) {
        $roleIds = $user->roles()->pluck('roles.id');

        return $query->where(function ($q) use ($user, $roleIds) {
            $q->where(['allocated_to_type' => 'user', 'allocated_to_id' => $user->id])
                ->orWhere(function ($q2) use ($roleIds) {
                    $q2->where('allocated_to_type', 'role')->whereIn('allocated_to_id', $roleIds);
                });
        });
    }

    public function scopeAssignedByMe($query, string $userId) {
        return $query->where('assigned_by_id', $userId);
    }

    /** ToDo yang masih relevan untuk sweep: dated dan masih open. */
    public function scopeDueForReminder($query) {
        return $query->whereNotNull('due_date')->where('status', 'open');
    }

    /**
     * Lead days efektif: set milik user, selalu menyertakan H-1, urut menurun.
     *
     * @return array<int, int>
     */
    public function effectiveLeadDays(): array {
        $days   = array_map('intval', $this->reminder_lead_days ?? []);
        $days   = array_filter($days, fn (int $d) => $d > 0);
        $days[] = 1;
        $days   = array_values(array_unique($days));
        rsort($days);

        return $days;
    }
}

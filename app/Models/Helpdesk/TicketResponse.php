<?php

namespace App\Models\Helpdesk;

use App\Models\User\Assignable;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TicketResponse extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'start_date'   => 'datetime',
        'due_date'     => 'datetime',
        'end_date'     => 'datetime',
        'content_json' => 'array',
    ];

    public function ticket(): BelongsTo {
        return $this->belongsTo(Ticket::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function assignTo(): BelongsTo {
        return $this->belongsTo(Assignable::class, 'assign_to_id');
    }
}

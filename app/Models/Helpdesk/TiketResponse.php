<?php

namespace App\Models\Helpdesk;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TiketResponse extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'end_date' => 'datetime',
    ];

    public function tiket(): BelongsTo {
        return $this->belongsTo(Tiket::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function assignTo(): BelongsTo {
        return $this->belongsTo(User::class, 'assign_to_id');
    }
}

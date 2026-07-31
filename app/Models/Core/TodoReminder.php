<?php

namespace App\Models\Core;

use App\Enums\TodoReminderStage;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TodoReminder extends Model {
    use HasFactory, HasUlids;

    protected $guarded = ['id'];
    protected $casts   = [
        'stage'             => TodoReminderStage::class,
        'due_date_snapshot' => 'datetime',
        'sent_at'           => 'datetime',
    ];

    public function todo(): BelongsTo {
        return $this->belongsTo(Todo::class);
    }
}

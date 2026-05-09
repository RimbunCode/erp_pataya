<?php

namespace App\Models;

use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourseNote extends Model {
    use HasUlids;
    protected $guarded = ['id'];
    protected $casts   = [
        'is_urgent' => 'boolean',
    ];

    public function section() {
        return $this->belongsTo(CourseSection::class, 'section_id');
    }

    public function course(): BelongsTo {
        return $this->belongsTo(Course::class);
    }

    public function author(): BelongsTo {
        return $this->belongsTo(User::class, 'created_by');
    }
}
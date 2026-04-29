<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use App\Models\User\User;

class Submission extends Model {
    use HasUlids;
    protected $guarded = ['id'];
    protected $casts   = [
        'submitted_at' => 'datetime',
    ];

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function content(): BelongsTo {
        return $this->belongsTo(CourseContent::class, 'content_id');
    }

    public function files(): MorphToMany {
        return $this->morphToMany(File::class, 'fileable', 'fileables', 'fileable_id', 'file_id')
            ->using(Fileable::class)
            ->withTimestamps();
    }
}
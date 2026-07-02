<?php

namespace App\Models;

use App\Models\Core\File;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EnrollmentCertificateUpload extends Model {
    use HasUlids;

    protected $guarded = ['id'];
    protected $casts   = [
        'uploaded_at' => 'datetime',
    ];

    public function enrollment(): BelongsTo {
        return $this->belongsTo(Enrollment::class);
    }

    public function file(): BelongsTo {
        return $this->belongsTo(File::class, 'file_id');
    }

    public function uploader(): BelongsTo {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}

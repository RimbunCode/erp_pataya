<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Database\Eloquent\SoftDeletes;

class Fileable extends Pivot {
    use SoftDeletes;

    protected $table     = 'fileables';
    public $translateKey = 'core.fileable';
    protected $casts     = [
        'is_generated_pdf' => 'boolean',
    ];
    protected array $configColumns = [
        'fileable',
        'file',
    ];

    public function fileable() {
        return $this->morphTo('fileable', 'fileable_type', 'fileable_id');
    }

    public function file() {
        return $this->belongsTo(File::class, 'file_id');
    }
}

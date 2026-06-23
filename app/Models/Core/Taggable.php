<?php

namespace App\Models\Core;

use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Database\Eloquent\SoftDeletes;

class Taggable extends Pivot {
    use LinkModel, SoftDeletes;

    protected $table = 'taggables';
}

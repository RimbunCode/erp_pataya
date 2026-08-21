<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\Pivot;

class DeskMenuItem extends Pivot {
    use HasUlids;
}

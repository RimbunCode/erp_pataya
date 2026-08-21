<?php

namespace App\Events\Core;

use App\Models\Core\Desk;
use Illuminate\Foundation\Events\Dispatchable;

class DeskDeleted {
    use Dispatchable;

    public function __construct(public Desk $desk) {}
}

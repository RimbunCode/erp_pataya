<?php

namespace App\Events\Core;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AuditableModelSaved {
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Model $model,
        public readonly string $action,
        public readonly array $dataBefore = [],
        public readonly array $dataAfter = [],
    ) {}
}

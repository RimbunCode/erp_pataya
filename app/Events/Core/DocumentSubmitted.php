<?php

namespace App\Events\Core;

use App\Models\Model;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DocumentSubmitted {
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Model $document,
        public readonly ?Model $reference = null,
        public readonly ?array $data = null,
    ) {}
}

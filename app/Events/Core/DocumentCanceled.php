<?php

namespace App\Events\Core;

use App\Models\Core\ApprovalInstance;
use App\Models\Model;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DocumentCanceled {
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Model $document,
        public readonly ApprovalInstance $approvalInstance,
    ) {}
}

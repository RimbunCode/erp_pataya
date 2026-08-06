<?php

namespace App\Events\Core;

use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ApprovalDecided {
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly ApprovalInstance $approvalInstance,
        public readonly string $decision,
        public readonly ?ApprovalInstanceStep $nextPendingStep = null,
        public readonly ?string $notes = null,
    ) {}
}

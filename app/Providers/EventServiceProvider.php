<?php

namespace App\Providers;

use App\Events\Core\ApprovalDecided;
use App\Events\Core\AuditableModelSaved;
use App\Events\Core\DocumentCanceled;
use App\Events\Core\DocumentStatusChanged;
use App\Events\Core\DocumentSubmitted;
use App\Listeners\Core\Approval\AttachApprovalPdf;
use App\Listeners\Core\Approval\CancelPendingApprovalSteps;
use App\Listeners\Core\Approval\NotifyApprovalDecision;
use App\Listeners\Core\Approval\NotifyNextApprover;
use App\Listeners\Core\Audit\RecordAuditLog;
use App\Listeners\Core\Submission\CreateDocumentConnection;
use App\Listeners\Core\Submission\NotifyRoleOnStatusChange;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider {
    /**
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        DocumentCanceled::class => [
            CancelPendingApprovalSteps::class,
        ],
        AuditableModelSaved::class => [
            RecordAuditLog::class,
        ],
        ApprovalDecided::class => [
            AttachApprovalPdf::class,
            NotifyApprovalDecision::class,
            NotifyNextApprover::class,
        ],
        DocumentStatusChanged::class => [
            NotifyRoleOnStatusChange::class,
        ],
        DocumentSubmitted::class => [
            CreateDocumentConnection::class,
        ],
    ];
}

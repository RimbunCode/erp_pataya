<?php

namespace App\Providers;

use App\Events\Core\DocumentCanceled;
use App\Listeners\Core\Approval\CancelPendingApprovalSteps;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider {
    /**
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        DocumentCanceled::class => [
            CancelPendingApprovalSteps::class,
        ],
    ];
}

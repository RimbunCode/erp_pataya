<?php

namespace App\Jobs;

use App\Models\Enrollment;
use App\Services\CertificateService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;

class IssueCertificateJob implements ShouldQueue {
    use Queueable, InteractsWithQueue;

    public int $tries   = 3;
    public int $timeout = 120;

    public function __construct(public readonly Enrollment $enrollment) {}

    public function handle(CertificateService $service): void {
        $this->enrollment->load(['user', 'course.sections.contents']);

        if ($this->enrollment->certificate) return;
        if (! $service->isCourseCompleted($this->enrollment)) return;

        $service->issueCertificate($this->enrollment);
    }
}

<?php

namespace App\Jobs;

use App\Models\CertificateTemplate;
use App\Models\Enrollment;
use App\Services\CertificateService;
use App\Services\GradingService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class IssueCertificateFromTemplateJob implements ShouldQueue {
    use Queueable, InteractsWithQueue;

    public int $tries   = 3;
    public int $timeout = 120;

    public function __construct(public readonly Enrollment $enrollment) {}

    public function handle(CertificateService $service, GradingService $gradingService): void {
        if ($this->enrollment->certificate) {
            return;
        }

        $template = CertificateTemplate::where('course_id', $this->enrollment->course_id)->where('is_active', true)->first()
            ?? CertificateTemplate::whereNull('course_id')->where('is_active', true)->first();

        if (! $template) {
            Log::warning('Auto-issue certificate skipped: no active template', [
                'enrollment_id' => $this->enrollment->id,
            ]);
            return;
        }

        try {
            $service->issueFromTemplate($this->enrollment, $template, $gradingService);
        } catch (\RuntimeException $e) {
            Log::warning('Auto-issue certificate failed', [
                'enrollment_id' => $this->enrollment->id,
                'error'         => $e->getMessage(),
            ]);
        }
    }
}

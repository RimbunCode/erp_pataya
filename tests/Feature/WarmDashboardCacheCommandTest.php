<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Requirement H — Command tipis, cuma delegasi ke DashboardCacheWarmerService
 * (lihat DashboardCacheWarmerServiceTest utk cakupan logic warming-nya).
 * Di sini cukup pastikan wiring artisan command-nya benar.
 */
class WarmDashboardCacheCommandTest extends TestCase {
    use RefreshDatabase;

    public function test_command_runs_successfully_with_no_dashboards(): void {
        $this->artisan('dashboard:warm-cache')
            ->expectsOutputToContain('Number Card di-warm: 0')
            ->expectsOutputToContain('Chart di-warm: 0')
            ->assertExitCode(0);
    }
}

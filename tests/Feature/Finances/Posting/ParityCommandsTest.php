<?php

namespace Tests\Feature\Finances\Posting;

use App\Models\Finances\PostingParityLog;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 5.5 (Requirement 6.7, 11.4): `finance:parity-report` meringkas hasil per jenis dokumen dan
 * `finance:prune-parity-logs` menghapus catatan yang melewati retensi.
 */
class ParityCommandsTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingParityLog::class]);
    }

    private function log(string $type, string $status, ?string $createdAt = null): PostingParityLog {
        $log = PostingParityLog::forceCreate(['document_type' => $type, 'source_type' => 'X', 'source_id' => 'S' . random_int(1, 999999), 'status' => $status]);
        if ($createdAt !== null) {
            DB::table('posting_parity_logs')->where('id', $log->id)->update(['created_at' => $createdAt]);
        }

        return $log;
    }

    public function test_report_summarizes_counts_per_document_type_and_status(): void {
        $this->log('sales_invoice', 'match');
        $this->log('sales_invoice', 'match');
        $this->log('sales_invoice', 'mismatch');
        $this->log('purchase_receipt', 'engine_error');

        $this->artisan('finance:parity-report')
            ->expectsTable(
                ['Jenis dokumen', 'match', 'rounding', 'config_diff', 'mismatch', 'engine_error', 'total'],
                [
                    ['purchase_receipt', 0, 0, 0, 0, 1, 1],
                    ['sales_invoice', 2, 0, 0, 1, 0, 3],
                ],
            )
            ->assertSuccessful();
    }

    public function test_report_filters_by_type_and_since(): void {
        $this->log('sales_invoice', 'match', '2026-10-01 00:00:00');
        $this->log('sales_invoice', 'mismatch', '2026-11-10 00:00:00');
        $this->log('purchase_receipt', 'match', '2026-11-10 00:00:00');

        $this->artisan('finance:parity-report', ['--type' => 'sales_invoice', '--since' => '2026-11-01'])
            ->expectsTable(
                ['Jenis dokumen', 'match', 'rounding', 'config_diff', 'mismatch', 'engine_error', 'total'],
                [['sales_invoice', 0, 0, 0, 1, 0, 1]],
            )
            ->assertSuccessful();
    }

    public function test_report_rejects_unknown_type_and_bad_date_and_handles_empty(): void {
        $this->artisan('finance:parity-report', ['--type' => 'nope'])->assertFailed();
        $this->artisan('finance:parity-report', ['--since' => '12/11/2026'])->assertFailed();
        $this->artisan('finance:parity-report', ['--since' => '2026-13-45'])->assertFailed();
        $this->artisan('finance:parity-report', ['--since' => '2026-02-30'])->assertFailed();
        $this->artisan('finance:parity-report', ['--since' => '2026-1-5'])->assertFailed();
        $this->artisan('finance:parity-report')->expectsOutputToContain('Tidak ada catatan parity')->assertSuccessful();
    }

    public function test_prune_deletes_only_logs_older_than_the_configured_retention(): void {
        config(['finance.posting.parity_retention_days' => 90]);
        $old   = $this->log('sales_invoice', 'match', now()->subDays(120)->toDateTimeString());
        $fresh = $this->log('sales_invoice', 'match', now()->subDays(10)->toDateTimeString());

        $this->artisan('finance:prune-parity-logs')->assertSuccessful();

        $this->assertNull(PostingParityLog::query()->find($old->id));
        $this->assertNotNull(PostingParityLog::query()->find($fresh->id));
    }

    public function test_prune_days_option_overrides_config_and_validates(): void {
        $log = $this->log('sales_invoice', 'match', now()->subDays(10)->toDateTimeString());

        $this->artisan('finance:prune-parity-logs', ['--days' => '0'])->assertFailed();
        $this->assertNotNull(PostingParityLog::query()->find($log->id));

        Artisan::call('finance:prune-parity-logs', ['--days' => '5']);
        $this->assertNull(PostingParityLog::query()->find($log->id));
    }

    public function test_prune_is_scheduled_daily_without_overlapping(): void {
        $events = collect(app(Schedule::class)->events())
            ->filter(fn ($item) => str_contains((string) $item->command, 'finance:prune-parity-logs'));

        $this->assertCount(1, $events, 'finance:prune-parity-logs harus terdaftar tepat satu kali di scheduler.');
        $event = $events->first();
        $this->assertSame('30 3 * * *', $event->expression);
        $this->assertTrue((bool) $event->withoutOverlapping);
    }
}

<?php

namespace Tests\Feature\Finances\Posting;

use App\Models\Finances\PostingParityLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 6.2 dan Q-P2-23 (Requirement 8.3, 2026-11-22): halaman Parity Log baca-saja sebagai riwayat.
 * Daftar difilter jenis dokumen/status/tanggal; kontrol ubah mode engine dihapus bersama mode `off`/`shadow`.
 */
class PostingParityLogControllerTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingParityLog::class]);
        // Halaman Inertia baru belum ada di manifest Vite build lokal; test memeriksa props, bukan aset.
        $this->withoutVite();
        Cache::flush();
    }

    /**
     * @param  list<string>  $permissions  izin PostingParityLog
     */
    private function actingWith(array $permissions): static {
        return $this->withSession([
            'permissions' => [
                PostingParityLog::class => [0 => [['model' => PostingParityLog::class, 'level' => 0, 'only_creator' => false, 'permissions' => array_fill_keys($permissions, true)]]],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ])->withCookie('lang', 'en')->actingAs($this->user);
    }

    private function log(string $type, string $status, string $createdAt, ?array $diff = null): void {
        DB::table('posting_parity_logs')->insert([
            'id'            => (string) Str::ulid(),
            'document_type' => $type,
            'source_type'   => 'App\\Models\\Finances\\SalesInvoice',
            'source_id'     => (string) Str::ulid(),
            'status'        => $status,
            'diff'          => $diff === null ? null : json_encode($diff),
            'created_at'    => $createdAt,
            'is_example'    => false,
        ]);
    }

    public function test_index_requires_select_permission(): void {
        $this->actingWith(['read'])->get(route('postingParityLogs.index'))->assertForbidden();
    }

    public function test_index_lists_logs_newest_first_without_any_mode_controls(): void {
        $this->log('sales_invoice', 'match', '2026-11-01 10:00:00');
        $this->log('stock_entry', 'mismatch', '2026-11-02 10:00:00');

        $this->actingWith(['select'])->get(route('postingParityLogs.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Finances/PostingParityLogs/Index')
                ->has('logs.data', 2)
                ->where('logs.data.0.document_type', 'stock_entry')
                ->where('logs.data.0.source_type', 'SalesInvoice')
                ->missing('modes')
                ->missing('modeOptions')
                ->missing('canSwitchMode'));
    }

    public function test_index_filters_by_document_type_status_and_dates(): void {
        $this->log('sales_invoice', 'match', '2026-11-01 10:00:00');
        $this->log('sales_invoice', 'mismatch', '2026-11-05 10:00:00');
        $this->log('stock_entry', 'mismatch', '2026-11-10 10:00:00');

        $this->actingWith(['select'])->get(route('postingParityLogs.index', ['document_type' => 'sales_invoice']))
            ->assertInertia(fn ($page) => $page->has('logs.data', 2)->where('filters.document_type', 'sales_invoice'));

        $this->actingWith(['select'])->get(route('postingParityLogs.index', ['status' => 'mismatch']))
            ->assertInertia(fn ($page) => $page->has('logs.data', 2));

        $this->actingWith(['select'])->get(route('postingParityLogs.index', ['document_type' => 'sales_invoice', 'status' => 'mismatch']))
            ->assertInertia(fn ($page) => $page->has('logs.data', 1)->where('logs.data.0.status', 'mismatch'));

        $this->actingWith(['select'])->get(route('postingParityLogs.index', ['date_from' => '2026-11-05', 'date_to' => '2026-11-05']))
            ->assertInertia(fn ($page) => $page->has('logs.data', 1)->where('logs.data.0.document_type', 'sales_invoice'));

        $this->actingWith(['select'])->get(route('postingParityLogs.index', ['date_from' => '2026-11-06']))
            ->assertInertia(fn ($page) => $page->has('logs.data', 1)->where('logs.data.0.document_type', 'stock_entry'));
    }

    public function test_index_rejects_unknown_filter_values(): void {
        $this->actingWith(['select'])->get(route('postingParityLogs.index', ['document_type' => 'bukan_jenis']))->assertSessionHasErrors('document_type');
        $this->actingWith(['select'])->get(route('postingParityLogs.index', ['status' => 'aneh']))->assertSessionHasErrors('status');
        $this->actingWith(['select'])->get(route('postingParityLogs.index', ['date_from' => '2026-11-06', 'date_to' => '2026-11-01']))->assertSessionHasErrors('date_to');
    }

    public function test_diff_is_only_sent_to_users_with_read_permission(): void {
        $this->log('sales_invoice', 'mismatch', '2026-11-01 10:00:00', ['reason' => 'akun berbeda']);

        $this->actingWith(['select'])->get(route('postingParityLogs.index'))
            ->assertInertia(fn ($page) => $page->where('logs.data.0.diff', null));

        $this->actingWith(['select', 'read'])->get(route('postingParityLogs.index'))
            ->assertInertia(fn ($page) => $page->where('logs.data.0.diff.reason', 'akun berbeda'));
    }

    public function test_mode_controls_are_gone_even_for_the_switch_posting_mode_permission(): void {
        $this->actingWith(['select', 'switch_posting_mode'])->get(route('postingParityLogs.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->missing('modes')->missing('modeOptions')->missing('canSwitchMode'));

        $this->assertFalse(Route::has('postingParityLogs.switchMode'), 'Rute ubah mode dihapus (Q-P2-23).');
        $this->actingWith(['select', 'switch_posting_mode'])
            ->put(route('postingParityLogs.index') . '/modes/sales_invoice', ['mode' => 'on', 'confirmed' => true])
            ->assertNotFound();
    }
}

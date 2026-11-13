<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\PostingParityLog;
use App\Services\Finances\Posting\PostingModeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 6.2 (Requirement 6.8, 8.3, 11.3): halaman Parity Log dan kontrol mode engine. Daftar
 * difilter jenis dokumen/status/tanggal; mengubah mode hanya untuk izin `switch_posting_mode`, lewat
 * `PostingModeService`, dan `on` wajib dikonfirmasi.
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

    public function test_index_lists_logs_newest_first_with_all_modes_default_off(): void {
        $this->log('sales_invoice', 'match', '2026-11-01 10:00:00');
        $this->log('stock_entry', 'mismatch', '2026-11-02 10:00:00');

        $this->actingWith(['select'])->get(route('postingParityLogs.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Finances/PostingParityLogs/Index')
                ->has('logs.data', 2)
                ->where('logs.data.0.document_type', 'stock_entry')
                ->where('logs.data.0.source_type', 'SalesInvoice')
                ->where('modes', array_fill_keys(PostingDocumentType::values(), 'off'))
                ->where('canSwitchMode', false));
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

    public function test_can_switch_mode_flag_follows_the_permission(): void {
        $this->actingWith(['select', 'switch_posting_mode'])->get(route('postingParityLogs.index'))
            ->assertInertia(fn ($page) => $page->where('canSwitchMode', true));
    }

    public function test_switch_mode_requires_the_switch_posting_mode_permission(): void {
        $this->actingWith(['select', 'read'])
            ->put(route('postingParityLogs.switchMode', 'sales_invoice'), ['mode' => 'shadow'])
            ->assertForbidden();

        $this->assertSame('off', app(PostingModeResolver::class)->for(PostingDocumentType::SalesInvoice));
    }

    public function test_switch_mode_changes_only_the_requested_type(): void {
        $this->actingWith(['select', 'switch_posting_mode'])
            ->put(route('postingParityLogs.switchMode', 'sales_invoice'), ['mode' => 'shadow'])
            ->assertRedirect()
            ->assertSessionHas('success', fn (string $message): bool => str_contains($message, 'Sales Invoice') && str_contains($message, 'Shadow') && ! str_contains($message, 'finances'));

        $resolver = app(PostingModeResolver::class);
        $this->assertSame('shadow', $resolver->for(PostingDocumentType::SalesInvoice));
        $this->assertSame('off', $resolver->for(PostingDocumentType::PurchaseInvoice));

        $this->actingWith(['select', 'switch_posting_mode'])
            ->put(route('postingParityLogs.switchMode', 'sales_invoice'), ['mode' => 'off'])
            ->assertRedirect();
        $this->assertSame('off', $resolver->for(PostingDocumentType::SalesInvoice), 'Kembali ke off tanpa deploy.');
    }

    public function test_switch_to_on_requires_explicit_confirmation(): void {
        $this->actingWith(['select', 'switch_posting_mode'])
            ->put(route('postingParityLogs.switchMode', 'sales_invoice'), ['mode' => 'on'])
            ->assertSessionHasErrors('confirmed');
        $this->assertSame('off', app(PostingModeResolver::class)->for(PostingDocumentType::SalesInvoice));

        $this->actingWith(['select', 'switch_posting_mode'])
            ->put(route('postingParityLogs.switchMode', 'sales_invoice'), ['mode' => 'on', 'confirmed' => false])
            ->assertSessionHasErrors('confirmed');
        $this->assertSame('off', app(PostingModeResolver::class)->for(PostingDocumentType::SalesInvoice));

        $this->actingWith(['select', 'switch_posting_mode'])
            ->put(route('postingParityLogs.switchMode', 'sales_invoice'), ['mode' => 'on', 'confirmed' => true])
            ->assertRedirect();
        $this->assertSame('on', app(PostingModeResolver::class)->for(PostingDocumentType::SalesInvoice));
    }

    public function test_switch_mode_rejects_unknown_modes_input_and_document_types(): void {
        $this->actingWith(['select', 'switch_posting_mode'])
            ->put(route('postingParityLogs.switchMode', 'sales_invoice'), ['mode' => 'turbo'])
            ->assertSessionHasErrors('mode');

        $this->actingWith(['select', 'switch_posting_mode'])
            ->put(route('postingParityLogs.switchMode', 'sales_invoice'), ['mode' => 'shadow', 'posting_modes' => ['stock_entry' => 'on']])
            ->assertSessionHasErrors('posting_modes');

        $this->actingWith(['select', 'switch_posting_mode'])
            ->put(route('postingParityLogs.switchMode', 'bukan_jenis'), ['mode' => 'shadow'])
            ->assertNotFound();

        $resolver = app(PostingModeResolver::class);
        foreach (PostingDocumentType::cases() as $type) {
            $this->assertSame('off', $resolver->for($type));
        }
    }
}

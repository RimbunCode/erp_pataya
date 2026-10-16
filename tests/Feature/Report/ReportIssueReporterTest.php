<?php

namespace Tests\Feature\Report;

use App\Models\Core\FormatingSeries;
use App\Models\Helpdesk\Ticket;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\ReportIssueNotification;
use App\Services\Report\ReportIssueReporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class ReportIssueReporterTest extends TestCase {
    use RefreshDatabase;

    private User $creator;

    protected function setUp(): void {
        parent::setUp();

        // is_example dan FormatingSeries Ticket ditambahkan di prod lewat init, bukan migration.
        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! FormatingSeries::where('model', Ticket::class)->exists()) {
            FormatingSeries::create([
                'model'  => Ticket::class,
                'name'   => 'Ticket',
                'format' => '#@[yy]/@[iiii]',
                'logs'   => ['iy' => []],
            ]);
        }

        config(['report.issue_role' => 'IT']);
        app()->setLocale('id');

        $this->creator = User::factory()->create();
        $this->actingAs($this->creator);
    }

    public function test_ticket_dibuat_dengan_type_priority_dan_assign_ke_role_it(): void {
        Notification::fake();
        $itRole = Role::create(['name' => 'IT', 'description' => 'Tim IT', 'is_disabled' => false]);

        $ticket = app(ReportIssueReporter::class)->report(
            reportName: 'Stok Persediaan',
            filterSummary: ['Gudang' => 'Gudang A'],
            kpiRows: 7,
            tableRows: 5,
            url: 'https://erp.test/reports/stock-balance',
        );

        $this->assertSame('bug_problem', $ticket->type);
        $this->assertSame('high', $ticket->priority);
        $this->assertSame('new', $ticket->status->value);
        $this->assertSame('Laporan Stok Persediaan: KPI tidak cocok dengan tabel', $ticket->subject);
        $this->assertSame('role', $ticket->assign_to_type);
        $this->assertSame($itRole->id, $ticket->assign_to_id);
        $this->assertSame($this->creator->id, $ticket->created_by_id);

        $content = $ticket->responses()->first()->content;
        $this->assertStringContainsString('Gudang: Gudang A', $content);
        $this->assertStringContainsString('Jumlah baris KPI: 7', $content);
        $this->assertStringContainsString('Jumlah baris tabel: 5', $content);
        $this->assertStringContainsString('https://erp.test/reports/stock-balance', $content);
    }

    public function test_notifikasi_terkirim_ke_anggota_role_it(): void {
        Notification::fake();
        $itRole    = Role::create(['name' => 'IT', 'description' => 'Tim IT', 'is_disabled' => false]);
        $memberOne = User::factory()->create();
        $memberTwo = User::factory()->create();
        $outsider  = User::factory()->create();
        $memberOne->roles()->attach($itRole->id);
        $memberTwo->roles()->attach($itRole->id);

        $ticket = app(ReportIssueReporter::class)->report(
            reportName: 'Laporan Penjualan',
            filterSummary: [],
            kpiRows: 2,
            tableRows: 1,
            url: 'https://erp.test/reports/sales',
        );

        Notification::assertSentTo([$memberOne, $memberTwo], ReportIssueNotification::class, function (ReportIssueNotification $notification) use ($ticket) {
            return $notification->ticket->is($ticket) && $notification->reportName === 'Laporan Penjualan';
        });
        Notification::assertNotSentTo($outsider, ReportIssueNotification::class);
    }

    public function test_markup_dari_input_tersimpan_sebagai_teks_bukan_markup(): void {
        Notification::fake();
        Role::create(['name' => 'IT', 'description' => 'Tim IT', 'is_disabled' => false]);

        $ticket = app(ReportIssueReporter::class)->report(
            reportName: 'Stok Persediaan',
            filterSummary: ['Gudang' => '<script>alert(1)</script>'],
            kpiRows: 1,
            tableRows: 0,
            url: 'https://erp.test/reports?q=<img src=x onerror=alert(1)>',
        );

        $content = $ticket->responses()->first()->content;

        // `content` dirender lewat dangerouslySetInnerHTML di Tickets/Show.jsx,
        // jadi markup dari request tidak boleh tersimpan apa adanya.
        $this->assertStringNotContainsString('<script>', $content);
        $this->assertStringNotContainsString('<img ', $content);
        $this->assertStringContainsString('&lt;script&gt;', $content);
        $this->assertStringContainsString('&lt;img ', $content);
    }

    public function test_gagal_jelas_bila_role_it_tidak_ada(): void {
        Notification::fake();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage("Role tim IT untuk laporan masalah tidak ditemukan: 'IT'");

        app(ReportIssueReporter::class)->report(
            reportName: 'Stok Persediaan',
            filterSummary: [],
            kpiRows: 1,
            tableRows: 0,
            url: 'https://erp.test/reports/stock-balance',
        );
    }
}

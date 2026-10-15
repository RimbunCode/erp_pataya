<?php

namespace Tests\Feature\Report;

use App\Models\Core\FormatingSeries;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Laporan tidak punya kolom pembuat, jadi izin only_creator dari modul sumber ditolak (403).
 * Pengguna dengan izin penuh di samping only_creator tetap boleh.
 */
class ReportOnlyCreatorTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // SalesInvoice ikut karena view report_sales membaca sales_invoices.code (kolom runtime).
        foreach ([User::class, FormatingSeries::class, SalesOrder::class, SalesInvoice::class] as $model) {
            $model::initPermissions();
        }

        $this->withoutVite();

        $this->user = User::factory()->create();
        $this->withCookie('lang', 'id');
    }

    /**
     * @param  list<bool>  $onlyCreatorFlags  satu entry izin per nilai flag only_creator
     */
    private function withModelEntries(string $model, array $onlyCreatorFlags): static {
        $entries = [];
        foreach ($onlyCreatorFlags as $onlyCreator) {
            $entries[] = ['model' => $model, 'level' => 0, 'only_creator' => $onlyCreator, 'permissions' => ['select' => true, 'read' => true]];
        }

        return $this->withSession([
            'permissions'         => [$model => [0 => $entries]],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ]);
    }

    #[Test]
    public function laporan_penjualan_ditolak_untuk_pengguna_only_creator(): void {
        $this->actingAs($this->user)->withModelEntries(SalesOrder::class, [true])
            ->get(route('reports.sales'))
            ->assertForbidden();
    }

    #[Test]
    public function export_ditolak_untuk_pengguna_only_creator(): void {
        $this->actingAs($this->user)->withModelEntries(SalesOrder::class, [true])
            ->get(route('reports.export', ['report' => 'sales', 'format' => 'csv']))
            ->assertForbidden();
    }

    #[Test]
    public function laporan_stok_ditolak_untuk_pengguna_only_creator(): void {
        $this->actingAs($this->user)->withModelEntries(StockLedgerEntry::class, [true])
            ->get(route('reports.stockMutation'))
            ->assertForbidden();
    }

    #[Test]
    public function izin_penuh_di_samping_only_creator_tetap_bisa_membuka_laporan(): void {
        $this->actingAs($this->user)->withModelEntries(SalesOrder::class, [true, false])
            ->get(route('reports.sales'))
            ->assertOk();
    }
}

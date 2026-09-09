<?php

namespace Tests\Feature\Models\Scopes;

use App\Models\Model as AppModel;
use App\Traits\DataTable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Model stub TANPA override $defaultSortColumn -- mayoritas model di
 * codebase, memverifikasi fallback macro tetap 'created_at' (regresi).
 */
class DsPlainRecord extends AppModel {
    use DataTable;

    protected $table               = 'ds_plain_records';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'name' => ['show' => true, 'order' => 0],
    ];

    public static function templateLink() {
        return ':name';
    }
}

/**
 * Model stub DENGAN override $defaultSortColumn ke 'transaction_date' --
 * merepresentasikan GeneralLedger/StockLedgerEntry (Requirement 2.4, spec
 * event-listener-migration-phase-3).
 */
class DsTransactionDatedRecord extends AppModel {
    use DataTable;

    protected $table               = 'ds_transaction_dated_records';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'name' => ['show' => true, 'order' => 0],
    ];

    public static function getDefaultSortColumn(): string {
        return 'transaction_date';
    }

    public static function templateLink() {
        return ':name';
    }
}

class DataTableScopeDefaultSortTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (['users', 'preferences'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('ds_plain_records')) {
            Schema::create('ds_plain_records', function ($t) {
                $t->id();
                $t->string('name')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
            });
        }
        if (! Schema::hasTable('ds_transaction_dated_records')) {
            Schema::create('ds_transaction_dated_records', function ($t) {
                $t->id();
                $t->string('name')->nullable();
                $t->timestamp('transaction_date')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
            });
        }
    }

    private function ajax(array $query = []): Request {
        return Request::create('/ds-records', 'GET', $query, server: [
            'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
        ]);
    }

    public function test_model_without_override_still_defaults_to_created_at_desc(): void {
        $older = DsPlainRecord::create(['name' => 'Older']);
        $older->forceFill(['created_at' => now()->subDays(5)])->save();
        $newer = DsPlainRecord::create(['name' => 'Newer']);
        $newer->forceFill(['created_at' => now()])->save();

        $result = DsPlainRecord::dataTable($this->ajax());
        $items  = $result['data']->items();

        $this->assertSame($newer->id, $items[0]->id, 'Tanpa override, urutan default tetap created_at desc.');
        $this->assertSame($older->id, $items[1]->id);
    }

    public function test_model_with_override_defaults_to_transaction_date_not_created_at(): void {
        // Sengaja dibalik: created_at vs transaction_date beda arah, supaya
        // test genuinely membuktikan macro pakai transaction_date bukan created_at.
        $transactedFirst = DsTransactionDatedRecord::create([
            'name'             => 'Transacted First',
            'transaction_date' => now()->subDays(10),
        ]);
        $transactedFirst->forceFill(['created_at' => now()])->save();

        $transactedSecond = DsTransactionDatedRecord::create([
            'name'             => 'Transacted Second',
            'transaction_date' => now()->subDays(1),
        ]);
        $transactedSecond->forceFill(['created_at' => now()->subDays(20)])->save();

        $result = DsTransactionDatedRecord::dataTable($this->ajax());
        $items  = $result['data']->items();

        $this->assertSame(
            $transactedSecond->id,
            $items[0]->id,
            'Model dengan $defaultSortColumn=transaction_date harus urut transaction_date desc, bukan created_at desc.',
        );
        $this->assertSame($transactedFirst->id, $items[1]->id);
    }

    public function test_explicit_sort_query_param_still_overrides_model_default(): void {
        $a = DsTransactionDatedRecord::create(['name' => 'A', 'transaction_date' => now()->subDays(1)]);
        $b = DsTransactionDatedRecord::create(['name' => 'B', 'transaction_date' => now()->subDays(2)]);

        // ?sort=name (ascending) HARUS menang atas default model manapun.
        $result = DsTransactionDatedRecord::dataTable($this->ajax(['sort' => 'name']));
        $items  = $result['data']->items();

        $this->assertSame($a->id, $items[0]->id, '?sort= eksplisit tetap prioritas di atas $defaultSortColumn.');
        $this->assertSame($b->id, $items[1]->id);
    }
}

<?php

namespace Tests\Feature\Models\Scopes;

use App\Models\Model as AppModel;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Tests\TestCase;

class SsCustomerStub extends AppModel {
    protected $table   = 'ss_customers';
    protected $guarded = ['id'];
    public $timestamps = false;
}

/**
 * Model stub dgn kolom: 'code' (string, searchable default), 'amount' (number,
 * BUKAN string), 'secret' (string TAPI searchable:false), relasi 'customer'
 * (BelongsTo, child 'name' string searchable) -- dipakai menguji sanitasi
 * searchScope (Requirement 5.2, 5.3): entri yg tak lolos (tak ter-resolve,
 * searchable:false, atau tipe akhir bukan string) dibuang diam-diam.
 */
class SsRecord extends AppModel {
    use DataTable;

    protected $table               = 'ss_records';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'code'     => ['show' => true, 'order' => 0],
        'amount'   => ['show' => true, 'order' => 1, 'type' => 'number'],
        'secret'   => ['show' => true, 'order' => 2, 'searchable' => false],
        'customer' => ['show' => true, 'order' => 3],
    ];

    public function customer(): BelongsTo {
        return $this->belongsTo(SsCustomerStub::class, 'customer_id');
    }
}

/**
 * `$searchScope` HARUS dideklarasikan di kelas model sendiri (subclass
 * terpisah, bukan properti di SsRecord) -- pola sama dgn
 * $defaultGroupColumn/DtgDefaultGroupRecord (DataTableScopeGroupingTest):
 * PHP fatal kalau kelas yg `use` trait mendeklarasi ulang properti statis
 * trait dgn nilai beda, dan properti ini sengaja TIDAK dideklarasikan di
 * trait DataTable itu sendiri.
 */
class SsRecordWithScope extends SsRecord {
    protected static array $searchScope = [
        'code',            // valid: string, searchable default true
        'customer.name',   // valid: dot-notation relasi, child string searchable
        'amount',          // dibuang: type number (bukan string)
        'secret',          // dibuang: searchable:false
        'unknown_column',  // dibuang: tak ter-resolve
        'customer.unknown', // dibuang: segmen relasi ter-resolve, child tak ada
    ];
}

class DataTableScopeSearchScopeTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (['users', 'preferences'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('ss_customers')) {
            Schema::create('ss_customers', function ($t) {
                $t->id();
                $t->string('name')->nullable();
            });
        }
        if (! Schema::hasTable('ss_records')) {
            Schema::create('ss_records', function ($t) {
                $t->id();
                $t->string('code')->nullable();
                $t->decimal('amount', 10, 2)->nullable();
                $t->string('secret')->nullable();
                $t->unsignedBigInteger('customer_id')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
            });
        }
    }

    // Non-ajax (default) -> Utils::isInertiaRequest() true -> searchScope
    // dibaca via Inertia::getShared() (pola sama dgn DataTableScopeGroupingTest).
    private function inertiaRequest(array $query = []): Request {
        return Request::create('/ss-records', 'GET', $query);
    }

    public function test_search_scope_empty_when_model_has_no_property(): void {
        SsRecord::create(['code' => 'A']);

        SsRecord::dataTable($this->inertiaRequest());

        $this->assertSame([], Inertia::getShared('searchScope'));
    }

    public function test_search_scope_sanitizes_invalid_entries_and_keeps_valid_ones(): void {
        SsRecord::create(['code' => 'A']);

        SsRecordWithScope::dataTable($this->inertiaRequest());

        $this->assertSame(
            ['code', 'customer.name'],
            Inertia::getShared('searchScope'),
            'Hanya kolom string searchable yang ter-resolve (termasuk path relasi bertitik) yang di-share; sisanya dibuang diam-diam.',
        );
    }
}

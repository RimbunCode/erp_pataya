<?php

namespace Tests\Feature\Services\Core;

use App\Models\Model as AppModel;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdaptiveCustomerStub extends AppModel {
    protected $table   = 'adaptive_customers';
    protected $guarded = ['id'];
    public $timestamps = false;
}

/**
 * Model stub dengan relasi BelongsTo nyata untuk menguji prune SELECT + with()
 * lewat DataTableScope::dataTable().
 */
class AdaptiveRecord extends AppModel {
    use DataTable;

    protected $table               = 'adaptive_records';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'name'        => ['show' => true, 'order' => 0],
        'description' => ['show' => true, 'order' => 1],
        'customer'    => ['show' => true, 'order' => 2],
    ];
    public static ?string $tplOverride = null;

    public function customer(): BelongsTo {
        return $this->belongsTo(AdaptiveCustomerStub::class, 'customer_id');
    }

    public static function templateLink() {
        return static::$tplOverride ?? ':name';
    }
}

/**
 * Stub meniru ItemUnit: global scope join ke tabel lain + kolom hasil join
 * ditandai forceAppend di config (bukan kolom tabel sendiri).
 */
class JoinedRecord extends AppModel {
    use DataTable;

    protected $table               = 'joined_records';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'unit_code' => ['isLink' => true, 'show' => true, 'order' => 0, 'forceAppend' => true],
        'qty'       => ['show' => true, 'order' => 1],
    ];

    protected static function booted(): void {
        static::addGlobalScope('join_units', function (Builder $builder): void {
            $table = $builder->getModel()->getTable();
            $builder
                ->join('join_units', 'join_units.id', '=', "{$table}.unit_id")
                ->addSelect("{$table}.*")
                ->addSelect('join_units.code as unit_code');
        });
    }

    public static function templateLink() {
        return ':unit_code';
    }
}

class DataTableAdaptiveFetchTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (['users', 'preferences'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('adaptive_customers')) {
            Schema::create('adaptive_customers', function ($t) {
                $t->id();
                $t->string('name')->nullable();
                $t->boolean('is_example')->default(false);
            });
        }
        if (! Schema::hasTable('adaptive_records')) {
            Schema::create('adaptive_records', function ($t) {
                $t->id();
                $t->string('name')->nullable();
                $t->string('description')->nullable();
                $t->unsignedBigInteger('customer_id')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
            });
        }
        if (! Schema::hasTable('join_units')) {
            Schema::create('join_units', function ($t) {
                $t->id();
                $t->string('code')->nullable();
            });
        }
        if (! Schema::hasTable('joined_records')) {
            Schema::create('joined_records', function ($t) {
                $t->id();
                $t->unsignedBigInteger('unit_id')->nullable();
                $t->integer('qty')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
            });
        }
    }

    private function seedData(): void {
        $cid = AdaptiveCustomerStub::create(['name' => 'Acme'])->id;
        AdaptiveRecord::insert([
            ['name' => 'A', 'description' => 'desc-a', 'customer_id' => $cid, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'B', 'description' => 'desc-b', 'customer_id' => $cid, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function ajax(array $query = [], array $cookies = []): Request {
        return Request::create('/x', 'GET', $query, $cookies, server: [
            'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
        ]);
    }

    public function test_hidden_relation_not_eager_loaded_when_cookie_excludes_it(): void {
        $this->seedData();
        // Cookie hanya menampilkan `name` → relasi customer tidak visible.
        $cookie = ['datatable_columns' => json_encode(['name' => ['size' => '1fr', 'order' => 0]])];

        $result = AdaptiveRecord::dataTable($this->ajax(cookies: $cookie));
        $row    = $result['data']->items()[0];

        $this->assertFalse($row->relationLoaded('customer'), 'customer tidak boleh ter-eager-load');
        // Kolom tersembunyi tak ter-select (selain PK/FK).
        $this->assertFalse(array_key_exists('description', $row->getAttributes()));
    }

    public function test_visible_relation_is_eager_loaded_with_fk_selected(): void {
        $this->seedData();
        $cookie = ['datatable_columns' => json_encode([
            'name'     => ['order' => 0],
            'customer' => ['order' => 1],
        ])];

        $result = AdaptiveRecord::dataTable($this->ajax(cookies: $cookie));
        $row    = $result['data']->items()[0];

        $this->assertTrue($row->relationLoaded('customer'), 'customer harus ter-eager-load');
        $this->assertNotNull($row->customer);
        // FK ikut ter-select agar relasi ter-resolve.
        $this->assertSame('Acme', $row->customer->name);
    }

    public function test_no_cookie_falls_back_to_show_true_columns(): void {
        $this->seedData();

        // Tanpa cookie → kolom show:true (name, description) + relasi customer.
        $result = AdaptiveRecord::dataTable($this->ajax());
        $row    = $result['data']->items()[0];

        $this->assertArrayHasKey('name', $row->getAttributes());
        $this->assertArrayHasKey('description', $row->getAttributes());
        $this->assertTrue($row->relationLoaded('customer'));
    }

    public function test_template_link_columns_forced_into_query(): void {
        $this->seedData();
        // templateLink rujuk `description` (kolom hidden) + `customer.name` (relasi,
        // dot-notation). Cookie hanya `name` → keduanya tetap wajib ikut query.
        AdaptiveRecord::$tplOverride = ':name - :description (:customer.name)';
        $cookie                      = ['datatable_columns' => json_encode(['name' => ['order' => 0]])];

        $result = AdaptiveRecord::dataTable($this->ajax(cookies: $cookie));
        $row    = $result['data']->items()[0];

        AdaptiveRecord::$tplOverride = null;

        // Kolom description (hidden) ter-select karena dirujuk templateLink.
        $this->assertArrayHasKey('description', $row->getAttributes());
        // Relasi customer (dot-notation) ter-eager-load + FK ter-select.
        $this->assertTrue($row->relationLoaded('customer'));
        $this->assertSame('Acme', $row->customer->name);
    }

    public function test_global_scope_join_force_append_column_does_not_break_query(): void {
        // ItemUnit-like: kolom unit_code (forceAppend, dari global scope join) tak
        // boleh ikut SELECT presisi (akan salah kualifikasi joined_records.unit_code)
        // & tak boleh throw. Query harus jalan, kolom join ter-resolve.
        $uid = DB::table('join_units')->insertGetId(['code' => 'KG']);
        DB::table('joined_records')->insert([
            'unit_id' => $uid, 'qty' => 5, 'is_example' => false, 'created_at' => now(), 'updated_at' => now(),
        ]);

        // Cookie kosong → semua show:true. forceAppend unit_code di-skip dari SELECT
        // presisi; global scope menyediakannya.
        $result = JoinedRecord::dataTable($this->ajax());
        $row    = $result['data']->items()[0];

        $this->assertSame('KG', $row->unit_code); // kolom join ter-resolve
        $this->assertSame(5, (int) $row->qty);
    }

    public function test_sort_by_hidden_local_column_stays_valid(): void {
        $this->seedData();
        // description disembunyikan tapi dipakai sort → query tetap valid.
        $cookie = ['datatable_columns' => json_encode(['name' => ['order' => 0]])];

        $result = AdaptiveRecord::dataTable($this->ajax(['sort' => '-description'], $cookie));
        $ids    = collect($result['data']->items())->pluck('name')->all();

        $this->assertSame(['B', 'A'], $ids); // desc by description
    }
}

<?php

namespace Tests\Feature\Models\Scopes;

use App\Models\Model as AppModel;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SdCustomerStub extends AppModel {
    use SoftDeletes;

    protected $table   = 'sd_customers';
    protected $guarded = ['id'];
    public $timestamps = false;
}

/**
 * Model stub dengan relasi ber-withTrashed(false) EKSPLISIT STATIS (bukan
 * bergantung state row, mis. $this->status) — untuk memverifikasi macro
 * dataTable() tidak menimpa relasi yang sudah override withTrashed sendiri
 * (Property 4). Constraint yang bergantung $this->attribute (mis. pola lama
 * PurchaseRequestItem::item()) TIDAK bisa direpresentasikan dengan aman di
 * sini — resolveForSafe() memanggil method relasi pada instance model kosong
 * (query-planning-time, bukan per-row), sehingga $this->status selalu null di
 * jalur List. Lihat catatan gap di tasks.md/memory.
 */
class SdOverrideRecord extends AppModel {
    use DataTable;

    protected $table               = 'sd_override_records';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'name'     => ['show' => true, 'order' => 0],
        'customer' => ['show' => true, 'order' => 1],
    ];

    public static function templateLink() {
        return ':name';
    }

    public function customer(): BelongsTo {
        return $this->belongsTo(SdCustomerStub::class, 'customer_id')->withTrashed(false);
    }
}

/**
 * Model stub belongsTo polos (tanpa override withTrashed) — merepresentasikan
 * mayoritas model di codebase, untuk memverifikasi Property 1.
 */
class SdRecord extends AppModel {
    use DataTable;

    protected $table               = 'sd_records';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'name'     => ['show' => true, 'order' => 0],
        'customer' => ['show' => true, 'order' => 1],
    ];

    public static function templateLink() {
        return ':name';
    }

    public function customer(): BelongsTo {
        return $this->belongsTo(SdCustomerStub::class, 'customer_id');
    }
}

class DataTableScopeSoftDeleteTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (['users', 'preferences'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('sd_customers')) {
            Schema::create('sd_customers', function ($t) {
                $t->id();
                $t->string('name')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamp('deleted_at')->nullable();
            });
        }
        if (! Schema::hasTable('sd_records')) {
            Schema::create('sd_records', function ($t) {
                $t->id();
                $t->string('name')->nullable();
                $t->unsignedBigInteger('customer_id')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
            });
        }
        if (! Schema::hasTable('sd_override_records')) {
            Schema::create('sd_override_records', function ($t) {
                $t->id();
                $t->string('name')->nullable();
                $t->string('status')->nullable();
                $t->unsignedBigInteger('customer_id')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
            });
        }
    }

    private function ajax(array $query = [], array $cookies = []): Request {
        return Request::create('/sd-records', 'GET', $query, $cookies, server: [
            'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
        ]);
    }

    private function dtCookie(string $path, array $cols): array {
        $key = 'datatable_columns_' . trim(str_replace('/', '_', $path), '_');

        return [$key => json_encode($cols)];
    }

    public function test_belongsto_relation_still_loaded_when_related_record_soft_deleted(): void {
        // Property 1: List tidak boleh kehilangan nama relasi karena soft-delete.
        $customer = SdCustomerStub::create(['name' => 'Acme']);
        $record   = SdRecord::create(['name' => 'Record A', 'customer_id' => $customer->id]);
        $customer->delete();

        $cookie = $this->dtCookie('sd-records', ['name' => ['size' => '1fr', 'order' => 0], 'customer' => ['size' => '1fr', 'order' => 1]]);
        $result = SdRecord::dataTable($this->ajax(cookies: $cookie));
        $row    = $result['data']->items()[0];

        $this->assertSame($record->id, $row->id);
        $this->assertTrue($row->relationLoaded('customer'));
        $this->assertNotNull($row->customer, 'Relasi customer tidak boleh null walau sudah di-soft-delete.');
        $this->assertNotNull($row->customer->deleted_at);
    }

    public function test_override_relation_constraint_not_overridden_by_macro(): void {
        // Property 4: relasi yang method-nya sendiri sudah memanggil withTrashed()
        // (di sini: withTrashed(false) statis) TIDAK boleh ditimpa macro dataTable()
        // global — reflection-skip di DataTableScope harus mendeteksi & melewatinya.
        $customer = SdCustomerStub::create(['name' => 'Acme Override']);
        $record   = SdOverrideRecord::create(['name' => 'Override Record', 'customer_id' => $customer->id]);
        $customer->delete();

        $cookie = $this->dtCookie('sd-override-records', ['name' => ['size' => '1fr', 'order' => 0], 'customer' => ['size' => '1fr', 'order' => 1]]);
        $result = SdOverrideRecord::dataTable($this->ajax(cookies: $cookie));
        $row    = $result['data']->items()[0];

        $this->assertSame($record->id, $row->id);
        $this->assertTrue($row->relationLoaded('customer'));
        $this->assertNull($row->customer, 'Relasi dengan withTrashed(false) eksplisit TIDAK boleh ditimpa macro global.');
    }
}

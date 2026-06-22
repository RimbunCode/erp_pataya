<?php

namespace Tests\Feature\Http;

use App\Models\Core\Currency;
use App\Models\Core\SavedFilter;
use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModelSelectDataTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        // Fokus pada logika endpoint; auth/app/csrf middleware di luar scope test ini
        // (resolusi roles user menyentuh global scope is_example yang butuh seeding penuh).
        $this->withoutMiddleware();

        // Tabel stub khusus test untuk menguji jalur per-item (select valid) tanpa
        // bergantung pada model produksi yang memicu global scope is_example.
        // Kolom is_example wajib: trait DataTable memakai HasExampleData yang
        // mendaftarkan global scope `where is_example = false` di tiap query.
        Schema::create('select_stub_parents', function ($table): void {
            $table->id();
            $table->string('code')->nullable();
            $table->boolean('is_example')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('select_stub_children', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('select_stub_parent_id')->nullable();
            $table->string('item')->nullable();
            $table->integer('quantity')->nullable();
            $table->boolean('is_example')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    private function submit(array $body) {
        return $this->actingAs(User::factory()->create())
            ->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model.selectData'), $body);
    }

    public function test_returns_paginated_shape_without_select(): void {
        Currency::factory()->count(3)->create();

        $res = $this->submit(['model' => Currency::class]);

        $res->assertOk()
            ->assertJsonStructure([
                'model', 'route', 'translateKey', 'columns', 'parentColumn',
                'data' => ['data', 'current_page', 'last_page', 'per_page', 'total'],
            ]);
        $this->assertSame(Currency::class, $res->json('model'));
        $this->assertSame(3, $res->json('data.total'));
    }

    public function test_base_filters_link_model_tree(): void {
        Currency::factory()->create(['name' => 'Alpha']);
        Currency::factory()->create(['name' => 'Beta']);

        $res = $this->submit([
            'model'       => Currency::class,
            'baseFilters' => ['name' => 'Alpha'],
        ]);

        $res->assertOk();
        $this->assertSame(1, $res->json('data.total'));
        $this->assertSame('Alpha', $res->json('data.data.0.name'));
    }

    public function test_builder_native_filters(): void {
        Currency::factory()->create(['name' => 'Alpha']);
        Currency::factory()->create(['name' => 'Beta']);

        $res = $this->submit([
            'model'   => Currency::class,
            'filters' => ['root' => ['k' => 'and', 'c' => [
                'i1' => ['k' => 'name', 'o' => 'matches', 'v' => 'Bet'],
            ]]],
        ]);

        $res->assertOk();
        $this->assertSame(1, $res->json('data.total'));
        $this->assertSame('Beta', $res->json('data.data.0.name'));
    }

    public function test_base_and_builder_filters_combined_with_and(): void {
        Currency::factory()->create(['name' => 'Alpha', 'symbol' => 'x']);
        Currency::factory()->create(['name' => 'Alpha', 'symbol' => 'y']);

        $res = $this->submit([
            'model'       => Currency::class,
            'baseFilters' => ['name' => 'Alpha'],
            'filters'     => ['root' => ['k' => 'and', 'c' => [
                'i1' => ['k' => 'symbol', 'o' => '=', 'v' => 'x'],
            ]]],
        ]);

        $res->assertOk();
        $this->assertSame(1, $res->json('data.total'));
    }

    public function test_saved_filter_via_fid(): void {
        Currency::factory()->create(['name' => 'Alpha']);
        Currency::factory()->create(['name' => 'Beta']);
        $saved = SavedFilter::factory()->create([
            'model'  => Currency::class,
            'filter' => ['root' => ['k' => 'and', 'c' => [
                'i1' => ['k' => 'name', 'o' => 'matches', 'v' => 'Alph'],
            ]]],
        ]);

        $res = $this->submit(['model' => Currency::class, 'fid' => $saved->id]);

        $res->assertOk();
        $this->assertSame(1, $res->json('data.total'));
        $this->assertSame('Alpha', $res->json('data.data.0.name'));
    }

    public function test_base_filters_and_fid_combined_with_and(): void {
        Currency::factory()->create(['name' => 'Alpha', 'symbol' => 'x']);
        Currency::factory()->create(['name' => 'Alpha', 'symbol' => 'y']);
        $saved = SavedFilter::factory()->create([
            'model'  => Currency::class,
            'filter' => ['root' => ['k' => 'and', 'c' => [
                'i1' => ['k' => 'symbol', 'o' => '=', 'v' => 'x'],
            ]]],
        ]);

        $res = $this->submit([
            'model'       => Currency::class,
            'baseFilters' => ['name' => 'Alpha'],
            'fid'         => $saved->id,
        ]);

        $res->assertOk();
        $this->assertSame(1, $res->json('data.total'));
    }

    public function test_invalid_model_returns_422(): void {
        $this->submit(['model' => 'App\\Models\\Nope'])->assertStatus(422);
    }

    public function test_invalid_select_returns_422(): void {
        $this->submit(['model' => Currency::class, 'select' => 'nonexistentRelation'])
            ->assertStatus(422);
    }

    public function test_select_resolves_related_model_and_paginates_relation_data(): void {
        $parent = SelectStubParent::create(['code' => 'P-1']);
        SelectStubChild::insert([
            ['select_stub_parent_id' => $parent->id, 'item' => 'A', 'quantity' => 5],
            ['select_stub_parent_id' => $parent->id, 'item' => 'B', 'quantity' => 3],
        ]);

        $res = $this->submit([
            'model'  => SelectStubParent::class,
            'select' => 'children',
        ]);

        $res->assertOk();
        // R1.4: model efektif = class relasi (child), data terpaginasi dari model relasi.
        $this->assertSame(SelectStubChild::class, $res->json('model'));
        $this->assertSame(2, $res->json('data.total'));
        // R1.6: translateKey dari model relasi efektif.
        $this->assertSame('stub.child', $res->json('translateKey'));
    }

    public function test_select_sets_parent_column_string(): void {
        $parent = SelectStubParent::create(['code' => 'P-9']);
        SelectStubChild::insert([
            ['select_stub_parent_id' => $parent->id, 'item' => 'A', 'quantity' => 5],
        ]);

        $res = $this->submit([
            'model'  => SelectStubParent::class,
            'select' => 'children',
        ]);

        $res->assertOk();
        // R9.1: parentColumn = snake($parentRelation) — string ter-set di response.
        $this->assertSame('parent', $res->json('parentColumn'));
    }

    /**
     * R9.3 — kolom parent di-re-inject ke metadata walau relasi parent
     * ber-`ignore:true` di configColumns (kondisi WorkOrderItem/PurchaseRequestItem).
     * Fix di selectData: re-inject entri kolom relasi parent (show=true) karena
     * getColumns membuangnya (LinkModel:605).
     */
    public function test_select_parent_column_present_in_metadata(): void {
        $parent = SelectStubParent::create(['code' => 'P-9']);
        SelectStubChild::insert([
            ['select_stub_parent_id' => $parent->id, 'item' => 'A', 'quantity' => 5],
        ]);

        $res = $this->submit([
            'model'  => SelectStubParent::class,
            'select' => 'children',
        ]);

        $res->assertOk();
        $parentCol = collect($res->json('columns'))->firstWhere('name', 'parent');
        $this->assertNotNull($parentCol, 'kolom parent harus ada di metadata columns');
        $this->assertTrue($parentCol['show'], 'kolom parent harus show=true');
        $this->assertSame('relation', $parentCol['type']);
    }

    /**
     * R9.2 — relasi parent ter-eager-load di data per-item. Karena selectData
     * me-re-inject kolom relasi parent sbg visible, adaptive-select macro
     * (collectRelation) menyertakan with(parent) + SELECT FK → belongsTo resolve.
     */
    public function test_select_eager_loads_parent_relation_in_data(): void {
        $parent = SelectStubParent::create(['code' => 'P-9']);
        SelectStubChild::insert([
            ['select_stub_parent_id' => $parent->id, 'item' => 'A', 'quantity' => 5],
        ]);

        $res = $this->submit([
            'model'  => SelectStubParent::class,
            'select' => 'children',
        ]);

        $res->assertOk();
        $this->assertSame('P-9', $res->json('data.data.0.parent.code'));
    }

    public function test_select_without_parent_relation_degrades_gracefully(): void {
        $parent = SelectStubParent::create(['code' => 'P-2']);
        SelectStubChild::insert([
            ['select_stub_parent_id' => $parent->id, 'item' => 'A', 'quantity' => 5],
        ]);

        $res = $this->submit([
            'model'  => SelectStubParent::class,
            'select' => 'childrenNoParent',
        ]);

        $res->assertOk();
        // R9.4: relasi child tanpa $parentRelation → parentColumn null, per-item tetap jalan.
        $this->assertNull($res->json('parentColumn'));
        $this->assertSame(1, $res->json('data.total'));
    }
}

/**
 * Stub model induk untuk menguji jalur `select` (mode per-item) tanpa memicu
 * global scope is_example milik model produksi. Di-back tabel select_stub_parents.
 */
class SelectStubParent extends Model {
    use DataTable;

    protected $table            = 'select_stub_parents';
    public string $translateKey = 'stub.parent';
    protected $guarded          = ['id'];

    public function children(): HasMany {
        return $this->hasMany(SelectStubChild::class, 'select_stub_parent_id');
    }

    public function childrenNoParent(): HasMany {
        return $this->hasMany(SelectStubChildNoParent::class, 'select_stub_parent_id');
    }
}

/**
 * Stub model relasi (child) dengan $parentRelation — menguji un-ignore kolom
 * parent + eager-load relasi balik. Relasi `parent` sengaja ignore:true di
 * configColumns agar menguji re-inject/un-ignore di selectData (R9.3).
 */
class SelectStubChild extends Model {
    use DataTable;

    protected $table               = 'select_stub_children';
    public string $translateKey    = 'stub.child';
    protected $guarded             = ['id'];
    public static $parentRelation  = 'parent';
    protected array $configColumns = [
        'parent' => ['ignore' => true],
    ];

    public function parent(): BelongsTo {
        return $this->belongsTo(SelectStubParent::class, 'select_stub_parent_id');
    }
}

/**
 * Stub model relasi tanpa $parentRelation — menguji degradasi anggun (R9.4).
 */
class SelectStubChildNoParent extends Model {
    use DataTable;

    protected $table   = 'select_stub_children';
    protected $guarded = ['id'];

    public function parent(): BelongsTo {
        return $this->belongsTo(SelectStubParent::class, 'select_stub_parent_id');
    }
}

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
        // Induk khusus menguji gate relasi via `with` di endpoint `model`
        // (LinkModel lookup). Punya templateLink (dibutuhkan __invoke).
        Schema::create('link_stub_parents', function ($table): void {
            $table->id();
            $table->string('code')->nullable();
            $table->boolean('is_example')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
        // Child dengan templateLink SENDIRI (mis. ItemVariant/Tax produksi) — menguji
        // apakah relasi via `with` otomatis membawa kolom templateLink child tanpa
        // perlu diminta eksplisit lewat `fields`.
        Schema::create('link_stub_children_templated', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('link_stub_parent_id')->nullable();
            $table->unsignedBigInteger('grandchild_id')->nullable();
            $table->string('label')->nullable();
            $table->string('untemplated_secret')->nullable();
            $table->boolean('is_example')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
        // Grandchild dgn templateLink sendiri — meniru PurchaseOrderItem::item
        // (relasi bertingkat: parent.items.item), diminta via `with` dot-notation.
        Schema::create('link_stub_grandchildren', function ($table): void {
            $table->id();
            $table->string('name_label')->nullable();
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

    private function submitModel(array $body) {
        return $this->actingAs(User::factory()->create())
            ->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), $body);
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

    // --- Endpoint `model` (LinkModel lookup): gate relasi via `with` + linkable. ---

    public function test_with_loads_linkable_relation(): void {
        $parent = LinkStubParent::create(['code' => 'P-1']);
        SelectStubChild::insert([
            ['select_stub_parent_id' => $parent->id, 'item' => 'A', 'quantity' => 5],
            ['select_stub_parent_id' => $parent->id, 'item' => 'B', 'quantity' => 3],
        ]);

        $res = $this->submitModel([
            'model' => LinkStubParent::class,
            'with'  => ['children'],
        ]);

        $res->assertOk();
        // Relasi yang diminta via `with` harus ikut ter-load di tiap row.
        $row = $res->json('data.0');
        $this->assertArrayHasKey('children', $row, 'relasi `children` harus ada di row');
        $this->assertCount(2, $row['children']);
        // Opsi B: kolom anak DISARING di SELECT — `item`/`quantity` non-linkable
        // tak diminta `fields`, jadi tak boleh bocor; hanya PK/FK/meta yang lolos.
        $this->assertArrayNotHasKey('item', $row['children'][0]);
        $this->assertArrayNotHasKey('quantity', $row['children'][0]);
    }

    public function test_without_with_relation_is_not_loaded(): void {
        $parent = LinkStubParent::create(['code' => 'P-2']);
        SelectStubChild::insert([
            ['select_stub_parent_id' => $parent->id, 'item' => 'A', 'quantity' => 5],
        ]);

        $res = $this->submitModel(['model' => LinkStubParent::class]);

        $res->assertOk();
        // Tanpa `with`, relasi tetap di-prune (perilaku gate lama).
        $this->assertArrayNotHasKey('children', $res->json('data.0'));
    }

    public function test_with_relation_loads_without_linkable_flag(): void {
        $parent = LinkStubParent::create(['code' => 'P-3']);
        SelectStubChild::insert([
            ['select_stub_parent_id' => $parent->id, 'item' => 'A', 'quantity' => 5],
        ]);

        $res = $this->submitModel([
            'model' => LinkStubParent::class,
            'with'  => ['childrenUnsafe'],
        ]);

        $res->assertOk();
        // `with` adalah kontrak relasi eksplisit form: relasi lolos TANPA syarat
        // `linkable` (linkable hanya gate kolom skalar). Kolom anak tetap disaring.
        // Response key snake_case (Eloquent $snakeAttributes): `childrenUnsafe`
        // dikirim camel di `with`, diterima `children_unsafe`.
        $this->assertArrayHasKey('children_unsafe', $res->json('data.0'));
    }

    /**
     * Jalur join MELEWATI SELECT-level pruning (blok `! has('joins')`), tapi
     * `$withRelations` diambil sebelum cabang join & `$query->with($with)` tetap
     * jalan. Relasi linkable yang diminta via `with` harus tetap ter-load dan
     * lolos filterRowColumns walau ada attribute `joins`.
     */
    public function test_with_linkable_relation_survives_join(): void {
        $parent = LinkStubParent::create(['code' => 'P-4']);
        SelectStubChild::insert([
            ['select_stub_parent_id' => $parent->id, 'item' => 'A', 'quantity' => 5],
            ['select_stub_parent_id' => $parent->id, 'item' => 'B', 'quantity' => 3],
        ]);

        $res = $this->submitModel([
            'model' => LinkStubParent::class,
            'with'  => ['children'],
            'joins' => [
                'select_stub_children' => [
                    'type' => 'left',
                    'on'   => [
                        'select_stub_children.select_stub_parent_id',
                        '=',
                        'link_stub_parents.id',
                    ],
                ],
            ],
        ]);

        $res->assertOk();
        $row = $res->json('data.0');
        $this->assertArrayHasKey('children', $row, 'relasi linkable harus tetap ter-load via with walau ada join');
        $this->assertCount(2, $row['children']);
    }

    /**
     * Relasi via `with` yang child-nya punya `templateLink()` sendiri harus otomatis
     * membawa kolom yang dirujuk templateLink child (mis. `label`), TANPA perlu
     * diminta eksplisit lewat `fields`. Ini kontrak utama LinkModel/SelectModel:
     * label relasi harus selalu bisa dirender.
     */
    public function test_with_relation_carries_its_own_template_link_columns(): void {
        $parent = LinkStubParent::create(['code' => 'P-5']);
        LinkStubChildTemplated::insert([
            ['link_stub_parent_id' => $parent->id, 'label' => 'Label-A', 'untemplated_secret' => 'SS'],
        ]);

        $res = $this->submitModel([
            'model' => LinkStubParent::class,
            'with'  => ['templatedChildren'],
        ]);

        $res->assertOk();
        $row = $res->json('data.0');
        $this->assertArrayHasKey('templated_children', $row);
        $child = $row['templated_children'][0];
        // templateLink child (':label') → wajib ikut walau tak diminta `fields`.
        $this->assertArrayHasKey('label', $child, 'kolom templateLink child harus otomatis ikut');
        $this->assertSame('Label-A', $child['label']);
        // Kolom non-templateLink & non-linkable tetap tersaring (defense-in-depth).
        $this->assertArrayNotHasKey('untemplated_secret', $child);
    }

    /**
     * Relasi BERTINGKAT via `with` dot-notation (mis. `templatedChildren.grandchild`,
     * meniru `items.item` di PurchaseOrder/SalesOrder) — grandchild yang punya
     * `templateLink()` sendiri harus tetap membawa kolom templateLink-nya, bukan
     * hanya level pertama (`templatedChildren`).
     */
    public function test_nested_with_relation_carries_grandchild_template_link_columns(): void {
        $parent     = LinkStubParent::create(['code' => 'P-6']);
        $grandchild = LinkStubGrandchild::create(['name_label' => 'GC-Label']);
        LinkStubChildTemplated::create([
            'link_stub_parent_id' => $parent->id,
            'grandchild_id'       => $grandchild->id,
            'label'               => 'Label-B',
        ]);

        $res = $this->submitModel([
            'model' => LinkStubParent::class,
            'with'  => ['templatedChildren.grandchild'],
        ]);

        $res->assertOk();
        $row   = $res->json('data.0');
        $child = $row['templated_children'][0] ?? null;
        $this->assertNotNull($child, 'relasi bertingkat templatedChildren harus ter-load');
        $grandchildRow = $child['grandchild'] ?? null;
        $this->assertNotNull($grandchildRow, 'grandchild harus ter-load via with dot-notation');
        // templateLink grandchild (':name_label') → wajib ikut walau tak diminta `fields`.
        $this->assertArrayHasKey('name_label', $grandchildRow, 'kolom templateLink grandchild harus otomatis ikut');
        $this->assertSame('GC-Label', $grandchildRow['name_label']);
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

/**
 * Stub induk untuk endpoint `model` (LinkModel lookup). Kedua relasi TIDAK
 * ber-`linkable` — meniru produksi di mana relasi yang diminta `with`
 * (mis. PurchaseOrder::items/supplier) memang tak ditandai linkable. Gate
 * meloloskan relasi `with` tanpa syarat linkable; kolom anak tetap disaring.
 */
class LinkStubParent extends Model {
    use DataTable;

    protected $table               = 'link_stub_parents';
    public string $translateKey    = 'stub.link';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'children',
        'childrenUnsafe',
        'templatedChildren',
    ];

    public static function templateLink() {
        return ':code';
    }

    public function children(): HasMany {
        return $this->hasMany(SelectStubChild::class, 'select_stub_parent_id');
    }

    public function childrenUnsafe(): HasMany {
        return $this->hasMany(SelectStubChild::class, 'select_stub_parent_id');
    }

    public function templatedChildren(): HasMany {
        return $this->hasMany(LinkStubChildTemplated::class, 'link_stub_parent_id');
    }
}

/**
 * Stub relasi child dengan `templateLink()` SENDIRI (meniru ItemVariant/Tax
 * produksi) — menguji apakah child-select otomatis menyertakan kolom yang
 * dirujuk templateLink child, bukan hanya kolom yang diminta `fields`.
 */
class LinkStubChildTemplated extends Model {
    use DataTable;

    protected $table               = 'link_stub_children_templated';
    public string $translateKey    = 'stub.link_templated';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'grandchild',
    ];

    public static function templateLink() {
        return ':label';
    }

    public function parent(): BelongsTo {
        return $this->belongsTo(LinkStubParent::class, 'link_stub_parent_id');
    }

    public function grandchild(): BelongsTo {
        return $this->belongsTo(LinkStubGrandchild::class, 'grandchild_id');
    }
}

/**
 * Stub relasi grandchild dengan `templateLink()` sendiri (meniru
 * PurchaseOrderItem::item di dalam PurchaseOrder::items) — menguji relasi
 * BERTINGKAT via `with` dot-notation membawa kolom templateLink-nya.
 */
class LinkStubGrandchild extends Model {
    use DataTable;

    protected $table            = 'link_stub_grandchildren';
    public string $translateKey = 'stub.link_grandchild';
    protected $guarded          = ['id'];

    public static function templateLink() {
        return ':name_label';
    }
}

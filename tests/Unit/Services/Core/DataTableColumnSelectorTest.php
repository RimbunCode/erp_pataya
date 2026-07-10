<?php

namespace Tests\Unit\Services\Core;

use App\Services\Core\DataTableColumnSelector;
use App\Services\Core\FilterColumnResolver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Model terkait minimal (BelongsTo target) — tanpa tabel; hanya butuh keyName.
 */
class SelectorRelatedStub extends Model {
    protected $table   = 'selector_related';
    protected $guarded = [];

    /** @return list<array<string,mixed>> */
    public static function getColumns(int $maxDepth = 0, bool $includeIgnore = false, ...$excepts): array {
        return [
            ['name' => 'id', 'type' => 'integer'],
            ['name' => 'name', 'type' => 'string'],
        ];
    }
}

/**
 * Model grandchild — relasi child-of-child dari SelectorRelatedTemplatedStub, dipakai
 * untuk menguji apakah dependsOn accessor templateLink child (mis. Warehouse::title
 * butuh branch.code) di-resolve otomatis walau relasi grandchild tak diminta eksplisit.
 */
class SelectorGrandchildStub extends Model {
    protected $table   = 'selector_grandchild';
    protected $guarded = [];
    public $timestamps = false;

    /** @return list<array<string,mixed>> */
    public static function getColumns(int $maxDepth = 0, bool $includeIgnore = false, ...$excepts): array {
        return [
            ['name' => 'id', 'type' => 'integer'],
            ['name' => 'label', 'type' => 'string'],
        ];
    }
}

/**
 * Model related dengan templateLink alias (`:code{:title}`) di mana accessor `title`
 * butuh relasi child-of-child (`grandchild.label`) — meniru pola nyata
 * Warehouse::title (butuh branch.code) / Branch::title. dependsOn dideklarasikan di
 * getColumns() sendiri (meniru configColumns produksi).
 */
class SelectorRelatedTemplatedStub extends Model {
    protected $table   = 'selector_related_templated';
    protected $guarded = [];
    protected $appends = ['title'];
    public $timestamps = false;

    public static function templateLink() {
        return ':code{:title}';
    }

    public function getTitleAttribute() {
        return $this->code . '/' . ($this->grandchild?->label ?? $this->grandchild_id);
    }

    public function grandchild(): BelongsTo {
        return $this->belongsTo(SelectorGrandchildStub::class, 'grandchild_id');
    }

    /** @return list<array<string,mixed>> */
    public static function getColumns(int $maxDepth = 0, bool $includeIgnore = false, ...$excepts): array {
        return [
            ['name' => 'id', 'type' => 'integer'],
            ['name' => 'code', 'type' => 'string'],
            ['name' => 'grandchild_id', 'type' => 'integer'],
            [
                'name'           => 'grandchild',
                'type'           => 'relation',
                'typeRelation'   => 'basic',
                'nameOfFunction' => 'grandchild',
                'related'        => SelectorGrandchildStub::class,
                'columns'        => [],
            ],
            [
                'name'      => 'title',
                'type'      => 'attribute',
                'dependsOn' => ['code', 'grandchild.label'],
            ],
        ];
    }
}

/**
 * Model related dengan templateLink POLOS (`:document`, tanpa dot, tanpa alias)
 * di mana placeholder-nya sendiri adalah relasi MORPHTO — meniru pola nyata
 * `ApprovalInstance::templateLink() = ':document'` (`document` = morphTo).
 * Dipakai menguji `:a.b` di mana `b` (segmen akhir) adalah RELASI, bukan kolom
 * scalar — beda dari kasus alias `{:accessor}` yang sudah ditangani sebelumnya.
 */
class SelectorInstanceStub extends Model {
    protected $table   = 'selector_instance';
    protected $guarded = [];
    public $timestamps = false;

    public static function templateLink() {
        return ':document';
    }

    public function document(): MorphTo {
        return $this->morphTo('document', 'document_type', 'document_id');
    }

    /** @return list<array<string,mixed>> */
    public static function getColumns(int $maxDepth = 0, bool $includeIgnore = false, ...$excepts): array {
        return [
            ['name' => 'id', 'type' => 'integer'],
            ['name' => 'document_type', 'type' => 'string', 'hidden' => true],
            ['name' => 'document_id', 'type' => 'integer', 'hidden' => true],
            [
                'name'           => 'document',
                'type'           => 'relation',
                'typeRelation'   => 'morph',
                'nameOfFunction' => 'document',
            ],
        ];
    }
}

/**
 * Model induk stub dengan relasi nyata (BelongsTo/HasMany/MorphTo) agar
 * getForeignKeyName()/getMorphType() ter-resolve tanpa query DB.
 */
class SelectorParentStub extends Model {
    protected $table   = 'selector_parents';
    protected $guarded = [];
    public $timestamps = false;

    public function customer(): BelongsTo {
        return $this->belongsTo(SelectorRelatedStub::class, 'customer_id');
    }

    public function items(): HasMany {
        return $this->hasMany(SelectorRelatedStub::class, 'parent_id');
    }

    public function referenceable(): MorphTo {
        return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
    }

    public function templatedRelated(): BelongsTo {
        return $this->belongsTo(SelectorRelatedTemplatedStub::class, 'templated_related_id');
    }

    public function instance(): BelongsTo {
        return $this->belongsTo(SelectorInstanceStub::class, 'instance_id');
    }
}

class DataTableColumnSelectorTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // Tabel nyata agar Schema::getColumnListing mengenali kolom DB (membedakan
        // kolom skalar asli dari accessor yang type-nya di-override).
        if (! Schema::hasTable('selector_parents')) {
            Schema::create('selector_parents', function ($t) {
                $t->id();
                $t->string('code')->nullable();
                $t->decimal('amount')->nullable();
                $t->string('secret_note')->nullable();
                $t->unsignedBigInteger('customer_id')->nullable();
                $t->string('referenceable_type')->nullable();
                $t->unsignedBigInteger('referenceable_id')->nullable();
                $t->dateTime('start_date')->nullable();
                $t->dateTime('end_date')->nullable();
                $t->string('state')->nullable();   // type render custom (formStatus), kolom DB nyata
                $t->decimal('total')->nullable();  // type render custom (currency), kolom DB nyata
                $t->unsignedBigInteger('templated_related_id')->nullable();
                $t->unsignedBigInteger('instance_id')->nullable();
            });
        }
        if (! Schema::hasTable('selector_grandchild')) {
            Schema::create('selector_grandchild', function ($t) {
                $t->id();
                $t->string('label')->nullable();
            });
        }
        if (! Schema::hasTable('selector_related_templated')) {
            Schema::create('selector_related_templated', function ($t) {
                $t->id();
                $t->string('code')->nullable();
                $t->unsignedBigInteger('grandchild_id')->nullable();
            });
        }
        if (! Schema::hasTable('selector_instance')) {
            Schema::create('selector_instance', function ($t) {
                $t->id();
                $t->string('document_type')->nullable();
                $t->unsignedBigInteger('document_id')->nullable();
            });
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function columns(): array {
        return [
            ['name' => 'id', 'type' => 'integer', 'show' => true],
            ['name' => 'code', 'type' => 'string', 'show' => true],
            ['name' => 'amount', 'type' => 'number', 'show' => true],
            ['name' => 'secret_note', 'type' => 'string', 'show' => false],
            [
                'name'           => 'customer',
                'type'           => 'relation',
                'typeRelation'   => 'basic',
                'nameOfFunction' => 'customer',
                'related'        => SelectorRelatedStub::class,
                'columns'        => [],
                'show'           => true,
            ],
            [
                'name'           => 'items',
                'type'           => 'relations',
                'typeRelation'   => 'basic',
                'nameOfFunction' => 'items',
                'show'           => true,
            ],
            [
                'name'           => 'referenceable',
                'type'           => 'relation',
                'typeRelation'   => 'morph',
                'nameOfFunction' => 'referenceable',
                'show'           => true,
            ],
            [
                'name'      => 'rent_date',
                'type'      => 'attribute',
                'dependsOn' => ['start_date', 'end_date'],
                'show'      => true,
            ],
            // Kolom DB nyata dgn type render custom (bukan di whitelist tipe lama).
            ['name' => 'state', 'type' => 'formStatus', 'show' => true],
            ['name' => 'total', 'type' => 'currency', 'show' => true],
            // Kolom virtual dari global scope join — bukan kolom tabel, forceAppend.
            ['name' => 'joined_label', 'type' => 'string', 'forceAppend' => true, 'show' => true],
            [
                'name'           => 'templated_related',
                'type'           => 'relation',
                'typeRelation'   => 'basic',
                'nameOfFunction' => 'templatedRelated',
                'related'        => SelectorRelatedTemplatedStub::class,
                'columns'        => [],
                'show'           => true,
            ],
            [
                'name'           => 'instance',
                'type'           => 'relation',
                'typeRelation'   => 'basic',
                'nameOfFunction' => 'instance',
                'related'        => SelectorInstanceStub::class,
                'columns'        => [],
                'show'           => true,
            ],
        ];
    }

    private function selector(): DataTableColumnSelector {
        return new DataTableColumnSelector(new FilterColumnResolver($this->columns()));
    }

    // ---- resolveForSafe (mesin kolom-aman, tanpa fallbackAll) -----------------

    /**
     * Bangun map kolom-aman {nama => true} dari daftar nama.
     *
     * @param  list<string>  $names
     * @return array<string,bool>
     */
    private function safeMap(array $names): array {
        return array_fill_keys($names, true);
    }

    public function test_resolve_for_safe_returns_no_fallback_all_key(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code', 'amount']),
            [],
            null,
        );

        $this->assertArrayNotHasKey('fallbackAll', $res);
        $this->assertArrayHasKey('select', $res);
        $this->assertArrayHasKey('with', $res);
    }

    public function test_resolve_for_safe_selects_only_safe_columns_plus_pk(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code']),
            [],
            null,
        );

        $this->assertContains('selector_parents.id', $res['select']);
        $this->assertContains('selector_parents.code', $res['select']);
        $this->assertNotContains('selector_parents.amount', $res['select']);
        $this->assertNotContains('selector_parents.secret_note', $res['select']);
    }

    public function test_resolve_for_safe_belongs_to_adds_fk_and_with_with_child_select(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code', 'customer']),
            ['customer' => $this->safeMap(['name'])],
            null,
        );

        $this->assertContains('selector_parents.customer_id', $res['select']);
        $this->assertArrayHasKey('customer', $res['with']);
        // Relasi non-morph → closure child-select (callable), bukan list nama.
        $this->assertIsCallable($res['with']['customer']);
    }

    public function test_resolve_for_safe_morph_with_without_child_select_closure(): void {
        // Morph tak bisa di-prune (tabel beda per-row) → with tanpa closure child-select.
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['referenceable']),
            [],
            null,
        );

        $this->assertContains('selector_parents.referenceable_id', $res['select']);
        $this->assertContains('selector_parents.referenceable_type', $res['select']);
        $this->assertArrayHasKey('referenceable', $res['with']);
        $this->assertNotInstanceOf(\Closure::class, $res['with']['referenceable']);
    }

    public function test_resolve_for_safe_force_append_skipped_without_throw(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code', 'joined_label']),
            [],
            null,
        );

        $this->assertNotContains('joined_label', $res['select']);
        $this->assertContains('selector_parents.code', $res['select']);
    }

    public function test_resolve_for_safe_append_with_depends_on_selects_source(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['rent_date']),
            [],
            null,
        );

        $this->assertContains('selector_parents.start_date', $res['select']);
        $this->assertContains('selector_parents.end_date', $res['select']);
    }

    public function test_resolve_for_safe_append_without_depends_on_always_throws(): void {
        $columns = [
            ['name' => 'id', 'type' => 'integer'],
            ['name' => 'computed', 'type' => 'attribute'], // tanpa dependsOn
        ];
        $selector = new DataTableColumnSelector(new FilterColumnResolver($columns));

        // Strict: throw bahkan di production (beda dgn resolve() lama).
        $this->app['env'] = 'production';
        $this->expectException(\RuntimeException::class);
        $selector->resolveForSafe($columns, new SelectorParentStub, $this->safeMap(['computed']), [], null);
    }

    public function test_resolve_for_safe_unique_select_and_with(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['id', 'code', 'customer']),
            ['customer' => $this->safeMap(['name'])],
            ':code (:customer.name)',
        );

        $this->assertSame(array_values(array_unique($res['select'])), $res['select']);
        $this->assertSame(array_keys($res['with']), array_values(array_unique(array_keys($res['with']))));
    }

    public function test_resolve_for_safe_template_link_scalar_forced_into_select(): void {
        // secret_note tak aman, tapi templateLink merujuknya → wajib ikut SELECT.
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code']),
            [],
            ':code - :secret_note',
        );

        $this->assertContains('selector_parents.secret_note', $res['select']);
    }

    public function test_resolve_for_safe_template_link_relation_adds_with_and_fk(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code']),
            [],
            ':code (:customer.name)',
        );

        $this->assertArrayHasKey('customer', $res['with']);
        $this->assertContains('selector_parents.customer_id', $res['select']);
    }

    /**
     * Reproduksi bug: relasi child (`templatedRelated`) yang punya `templateLink()`
     * ber-alias (`:code{:title}`) di mana accessor `title` butuh relasi child-of-child
     * (`grandchild.label`, dideklarasikan lewat `dependsOn` di getColumns child — meniru
     * Warehouse::title butuh branch.code) — closure child-select HARUS menyertakan FK
     * `grandchild_id` DAN meng-eager-load `grandchild` di dalam closure-nya sendiri,
     * walau `grandchild` TIDAK diminta eksplisit lewat fields/with (safeRelationColumns
     * kosong untuk relasi ini). Tanpa fix, childSelectClosure hanya baca kolom lokal
     * dari regex templateLink (buang alias {:title} sepenuhnya) dan tidak pernah
     * memproses dependsOn accessor child.
     */
    public function test_resolve_for_safe_child_template_link_alias_depends_on_relation_is_included(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code', 'templated_related']),
            [], // safeRelationColumns kosong — grandchild TIDAK diminta eksplisit
            null,
        );

        // Key `with` = nameOfFunction (camelCase, nama method PHP asli), bukan
        // `name` snake_case (konvensi Eloquent with()/collectSafeRelation).
        $this->assertArrayHasKey('templatedRelated', $res['with']);
        $closure = $res['with']['templatedRelated'];
        $this->assertIsCallable($closure, 'child-select closure harus terbentuk (bukan null/SELECT *)');

        // Jalankan closure pada query nyata utk inspeksi select+with yang dihasilkan.
        $query = SelectorRelatedTemplatedStub::query();
        $closure($query);

        $this->assertContains(
            'selector_related_templated.grandchild_id',
            $query->getQuery()->columns ?? [],
            'FK grandchild_id harus ikut ter-SELECT agar accessor title (dependsOn grandchild.label) bisa resolve',
        );
        $this->assertArrayHasKey(
            'grandchild',
            $query->getEagerLoads(),
            'relasi grandchild harus ikut di-eager-load di dalam child-select, meski tak diminta eksplisit',
        );
    }

    /**
     * Sama seperti test di atas, tapi relasi `templatedRelated` dijangkau lewat
     * MODEL ROOT templateLink (`:templatedRelated`, mis. `:customerBranch` di
     * SalesOrder), bukan `safeColumns` biasa — jalur `resolveTemplateHead`. Ini
     * mensimulasikan `DataTableScope` (halaman index), yang MEMANG selalu
     * memanggil `resolveForSafe(..., safeRelationColumns: [], $templateLink)` —
     * child-select SEPENUHNYA bergantung pada resolusi templateLink+dependsOn
     * child, karena safeRelationColumns tidak pernah diisi utk index.
     */
    public function test_resolve_for_safe_root_template_link_head_relation_carries_child_depends_on(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code']),
            [], // DataTableScope selalu kirim [] — index tak pernah eksplisit fields
            ':code (:templatedRelated)',
        );

        $this->assertArrayHasKey('templatedRelated', $res['with']);
        $closure = $res['with']['templatedRelated'];
        $this->assertIsCallable($closure);

        $query = SelectorRelatedTemplatedStub::query();
        $closure($query);

        $this->assertContains(
            'selector_related_templated.grandchild_id',
            $query->getQuery()->columns ?? [],
            'jalur index (root templateLink → relasi) tetap harus bawa FK grandchild_id',
        );
        $this->assertArrayHasKey('grandchild', $query->getEagerLoads());
    }

    /**
     * Reproduksi bug NYATA (bukan cuma SELECT/eager-load, tapi APPENDS): closure
     * child-select `afterQuery` melakukan `setAppends([])` — blank slate appends
     * bawaan class, SEHARUSNYA diikuti `setAppends($needed)` ulang (persis pola
     * `applyAppends` utk model ROOT). Tanpa langkah kedua ini, accessor templateLink
     * child (`title`) HILANG TOTAL dari `toArray()` — bukan cuma `null`, key-nya
     * sendiri tidak ada — walau kolom sumbernya (`code`, `grandchild.label`) sudah
     * benar ter-SELECT. Test sebelumnya (query builder select()/getEagerLoads())
     * TIDAK menangkap bug ini karena tak pernah menjalankan query & serialize
     * instance sungguhan.
     */
    public function test_child_select_closure_reappends_template_link_accessor_after_blank_slate(): void {
        $grandchild = SelectorGrandchildStub::create(['label' => 'GC-Label']);
        $related    = SelectorRelatedTemplatedStub::create([
            'code'          => 'CODE-1',
            'grandchild_id' => $grandchild->id,
        ]);
        $parent = SelectorParentStub::create(['templated_related_id' => $related->id]);

        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code', 'templated_related']),
            [],
            null,
        );
        $closure = $res['with']['templatedRelated'];

        $loaded = SelectorParentStub::query()
            ->with(['templatedRelated' => $closure])
            ->find($parent->id);

        $array = $loaded->templatedRelated->toArray();

        $this->assertArrayHasKey(
            'title',
            $array,
            'accessor title (dependsOn code+grandchild.label) harus ikut di-append ulang '
            . 'setelah afterQuery blank-slate, bukan hilang total',
        );
        $this->assertSame('CODE-1/GC-Label', $array['title']);
    }

    /**
     * Reproduksi bug NYATA (kasus `/approvals`, ApprovalInstanceStep → approvalInstance
     * → document): templateLink child (`SelectorInstanceStub::templateLink() = ':document'`)
     * placeholder-nya SENDIRI adalah RELASI morphTo (bukan kolom scalar, bukan alias
     * `{:accessor}`). `templateLinkLocalColumns`/`childAppendDependsCols` hanya
     * menangani kolom DB nyata & alias accessor — placeholder yang ternyata relasi
     * dibuang begitu saja di intersect `dbColumns` (`document` bukan kolom DB).
     * Akibatnya relasi `document` TIDAK PERNAH di-with di dalam closure child
     * `instance`, sehingga response akhir `instance.document` selalu `null` walau
     * data morph-nya ada di DB — persis payload asli `/approvals` yang dikirim user
     * (`approval_instance.document: null`).
     */
    public function test_child_select_closure_carries_relation_placeholder_in_child_template_link(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code', 'instance']),
            [], // safeRelationColumns kosong — document TIDAK diminta eksplisit
            null,
        );

        $this->assertArrayHasKey('instance', $res['with']);
        $closure = $res['with']['instance'];
        $this->assertIsCallable($closure, 'child-select closure harus terbentuk');

        $query = SelectorInstanceStub::query();
        $closure($query);

        $this->assertContains(
            'selector_instance.document_id',
            $query->getQuery()->columns ?? [],
            'FK document_id harus ikut ter-SELECT agar relasi morphTo document bisa resolve',
        );
        $this->assertContains(
            'selector_instance.document_type',
            $query->getQuery()->columns ?? [],
            'morph type document_type harus ikut ter-SELECT',
        );
        $this->assertArrayHasKey(
            'document',
            $query->getEagerLoads(),
            'relasi document (morphTo, placeholder templateLink child) harus ikut '
            . 'di-eager-load di dalam child-select, meski tak diminta eksplisit — '
            . 'tanpa ini label instance.document selalu null (bug /approvals)',
        );
    }

    /**
     * Sama seperti test di atas, tapi placeholder `:instance.document` dijangkau
     * lewat templateLink MODEL ROOT (`resolveTemplatePath`, bukan `safeColumns`
     * relasi biasa) — meniru persis `ApprovalInstanceStep::templateLink() =
     * ':approvalInstance.document'` saat `ApprovalInstanceStep` sendiri adalah
     * model utama request (mis. endpoint /approvals). `resolveTemplatePath`
     * hanya proses HOP PERTAMA (`approvalInstance`/`instance`) lalu delegasikan
     * child-select ke `childSelectClosure` — fix `childTemplateLinkRelationCols`
     * di dalamnya harus tetap berlaku utk kasus ROOT ini juga.
     */
    public function test_resolve_for_safe_root_template_link_path_relation_end_segment(): void {
        $res = $this->selector()->resolveForSafe(
            $this->columns(),
            new SelectorParentStub,
            $this->safeMap(['code']),
            [], // DataTableScope/lookup ROOT selalu kirim [] utk relasi tak diminta
            ':instance.document',
        );

        $this->assertArrayHasKey('instance', $res['with']);
        $closure = $res['with']['instance'];
        $this->assertIsCallable($closure);

        $query = SelectorInstanceStub::query();
        $closure($query);

        $this->assertContains('selector_instance.document_id', $query->getQuery()->columns ?? []);
        $this->assertContains('selector_instance.document_type', $query->getQuery()->columns ?? []);
        $this->assertArrayHasKey(
            'document',
            $query->getEagerLoads(),
            'jalur ROOT templateLink (:a.b, b=relasi) juga harus bawa relasi document',
        );
    }

    // ---- safeColumnsFromVisible (konversi visibleKeys cookie → map) -----------

    public function test_safe_columns_from_visible_null_uses_show_true(): void {
        $safe = $this->selector()->safeColumnsFromVisible($this->columns(), null);

        $this->assertArrayHasKey('code', $safe);
        $this->assertArrayHasKey('amount', $safe);
        $this->assertArrayNotHasKey('secret_note', $safe); // show:false
    }

    public function test_safe_columns_from_visible_uses_cookie_subset(): void {
        $safe = $this->selector()->safeColumnsFromVisible($this->columns(), ['code']);

        $this->assertSame(['code' => true], $safe);
    }

    public function test_safe_columns_from_visible_includes_extra_keys(): void {
        $safe = $this->selector()->safeColumnsFromVisible($this->columns(), ['code'], ['secret_note']);

        $this->assertArrayHasKey('code', $safe);
        $this->assertArrayHasKey('secret_note', $safe);
    }
}

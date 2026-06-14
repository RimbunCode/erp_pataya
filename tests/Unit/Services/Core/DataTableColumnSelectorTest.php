<?php

namespace Tests\Unit\Services\Core;

use App\Services\Core\DataTableColumnSelector;
use App\Services\Core\FilterColumnResolver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Model terkait minimal (BelongsTo target) — tanpa tabel; hanya butuh keyName.
 */
class SelectorRelatedStub extends Model {
    protected $table   = 'selector_related';
    protected $guarded = [];

    /** @return list<array<string,mixed>> */
    public static function getColumns(int $maxDepth = 0): array {
        return [
            ['name' => 'id', 'type' => 'integer'],
            ['name' => 'name', 'type' => 'string'],
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

    public function customer(): BelongsTo {
        return $this->belongsTo(SelectorRelatedStub::class, 'customer_id');
    }

    public function items(): HasMany {
        return $this->hasMany(SelectorRelatedStub::class, 'parent_id');
    }

    public function referenceable(): MorphTo {
        return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
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
        ];
    }

    private function selector(): DataTableColumnSelector {
        return new DataTableColumnSelector(new FilterColumnResolver($this->columns()));
    }

    public function test_empty_cookie_uses_show_true_columns(): void {
        $res = $this->selector()->resolve($this->columns(), new SelectorParentStub, null);

        $this->assertFalse($res['fallbackAll']);
        // Skalar show:true ikut; secret_note (show:false) tidak.
        $this->assertContains('code', $res['select']);
        $this->assertContains('amount', $res['select']);
        $this->assertNotContains('secret_note', $res['select']);
        // PK selalu ada.
        $this->assertContains('id', $res['select']);
    }

    public function test_subset_scalar_selects_only_subset_plus_pk(): void {
        $res = $this->selector()->resolve($this->columns(), new SelectorParentStub, ['code']);

        $this->assertEqualsCanonicalizing(['id', 'code'], $res['select']);
        $this->assertSame([], $res['with']);
        $this->assertFalse($res['fallbackAll']);
    }

    public function test_belongs_to_visible_adds_fk_and_with(): void {
        $res = $this->selector()->resolve($this->columns(), new SelectorParentStub, ['code', 'customer']);

        $this->assertContains('customer_id', $res['select']);
        $this->assertContains('customer', $res['with']);
    }

    public function test_morph_visible_adds_type_and_id(): void {
        $res = $this->selector()->resolve($this->columns(), new SelectorParentStub, ['referenceable']);

        $this->assertContains('referenceable_id', $res['select']);
        $this->assertContains('referenceable_type', $res['select']);
        $this->assertContains('referenceable', $res['with']);
    }

    public function test_has_many_plural_relation_not_auto_with(): void {
        // Relasi plural (HasMany/`relations`) tidak di-eager-load default (meniru
        // perilaku lama; bisa lewat ?with eksplisit di scope). Tak ada FK tambahan.
        $res = $this->selector()->resolve($this->columns(), new SelectorParentStub, ['items']);

        $this->assertNotContains('items', $res['with']);
        $this->assertEqualsCanonicalizing(['id'], $res['select']);
    }

    public function test_append_with_local_depends_on_selects_source_columns(): void {
        $res = $this->selector()->resolve($this->columns(), new SelectorParentStub, ['rent_date']);

        $this->assertContains('start_date', $res['select']);
        $this->assertContains('end_date', $res['select']);
        $this->assertFalse($res['fallbackAll']);
    }

    public function test_append_with_relation_depends_on_adds_with_and_fk(): void {
        $columns = $this->columns();
        // Ubah rent_date agar depends ke relasi customer.name.
        foreach ($columns as &$col) {
            if (($col['name'] ?? null) === 'rent_date') {
                $col['dependsOn'] = ['code', 'customer.name'];
            }
        }
        unset($col);

        $selector = new DataTableColumnSelector(new FilterColumnResolver($columns));
        $res      = $selector->resolve($columns, new SelectorParentStub, ['rent_date']);

        $this->assertContains('code', $res['select']);
        $this->assertContains('customer', $res['with']);
        $this->assertContains('customer_id', $res['select']);
    }

    public function test_append_without_depends_on_throws_in_non_production(): void {
        $columns = [
            ['name' => 'id', 'type' => 'integer', 'show' => true],
            ['name' => 'computed', 'type' => 'attribute', 'show' => true], // tanpa dependsOn
        ];
        $selector = new DataTableColumnSelector(new FilterColumnResolver($columns));

        $this->app['env'] = 'local';
        $this->expectException(\RuntimeException::class);
        $selector->resolve($columns, new SelectorParentStub, ['computed']);
    }

    public function test_append_without_depends_on_logs_and_fallbacks_in_production(): void {
        $columns = [
            ['name' => 'id', 'type' => 'integer', 'show' => true],
            ['name' => 'computed', 'type' => 'attribute', 'show' => true],
        ];
        $selector = new DataTableColumnSelector(new FilterColumnResolver($columns));

        $this->app['env'] = 'production';
        Log::shouldReceive('warning')->once();

        $res = $selector->resolve($columns, new SelectorParentStub, ['computed']);
        $this->assertTrue($res['fallbackAll']);
    }

    public function test_extra_keys_sort_local_added_to_select_without_with(): void {
        // secret_note tak visible tapi dipakai sort → harus ikut SELECT.
        $res = $this->selector()->resolve(
            $this->columns(),
            new SelectorParentStub,
            ['code'],
            extraKeys: ['secret_note'],
        );

        $this->assertContains('secret_note', $res['select']);
        $this->assertSame([], $res['with']);
    }

    public function test_template_link_scalar_placeholder_forced_into_select(): void {
        // Cookie hanya `code`, tapi templateLink merujuk secret_note (hidden) →
        // secret_note wajib ikut SELECT agar mobile view ter-render.
        $res = $this->selector()->resolve(
            $this->columns(),
            new SelectorParentStub,
            ['code'],
            templateLink: ':code - :secret_note',
        );

        $this->assertContains('secret_note', $res['select']);
    }

    public function test_template_link_relation_placeholder_adds_with_and_fk(): void {
        // templateLink rujuk customer.name → relasi customer di with + FK di select.
        $res = $this->selector()->resolve(
            $this->columns(),
            new SelectorParentStub,
            ['code'],
            templateLink: ':code (:customer.name)',
        );

        $this->assertContains('customer', $res['with']);
        $this->assertContains('customer_id', $res['select']);
    }

    public function test_template_link_alias_uses_inner_placeholder(): void {
        // `:code{:rent_date}` → pakai rent_date (append) → dependsOn-nya ke SELECT.
        $res = $this->selector()->resolve(
            $this->columns(),
            new SelectorParentStub,
            ['code'],
            templateLink: ':code{:rent_date} - :amount',
        );

        $this->assertContains('start_date', $res['select']);
        $this->assertContains('end_date', $res['select']);
        $this->assertFalse($res['fallbackAll']);
    }

    public function test_custom_type_db_column_selected_without_depends_on(): void {
        // state (formStatus) & total (currency) = kolom DB nyata dgn type render
        // custom → harus SELECT langsung, tanpa dependsOn, tanpa throw/fallback.
        $res = $this->selector()->resolve($this->columns(), new SelectorParentStub, ['state', 'total']);

        $this->assertContains('state', $res['select']);
        $this->assertContains('total', $res['select']);
        $this->assertFalse($res['fallbackAll']);
    }

    public function test_force_append_virtual_column_skipped_without_throw(): void {
        // joined_label (forceAppend, kolom virtual dari global scope join) → tak
        // di-SELECT (scope yang sediakan) & tak throw walau tanpa dependsOn.
        $res = $this->selector()->resolve($this->columns(), new SelectorParentStub, ['code', 'joined_label']);

        $this->assertNotContains('joined_label', $res['select']);
        $this->assertContains('code', $res['select']);
        $this->assertFalse($res['fallbackAll']);
    }

    public function test_unknown_key_is_ignored(): void {
        $res = $this->selector()->resolve($this->columns(), new SelectorParentStub, ['code', 'not_a_real_column']);

        $this->assertEqualsCanonicalizing(['id', 'code'], $res['select']);
        $this->assertFalse($res['fallbackAll']);
    }
}

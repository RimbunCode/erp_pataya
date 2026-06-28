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

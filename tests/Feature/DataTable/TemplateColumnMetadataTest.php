<?php

namespace Tests\Feature\DataTable;

use App\Models\Core\Branch;
use App\Models\Model;
use App\Services\Core\DataTableConfigCache;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TplMetaCustomer extends Model {
    protected $table   = 'tpl_meta_customers';
    protected $guarded = [];

    public static function templateLink() {
        return ':name';
    }
}

class TplMetaItem extends Model {
    protected $table   = 'tpl_meta_items';
    protected $guarded = [];

    public static function templateLink() {
        return ':name';
    }
}

/**
 * Model fixture: setiap jenis entri `configColumns` yang diubah/ditambah
 * computeColumnsFlat() (template, virtual, expression, progress, relations,
 * Attribute opt-in & non-opt-in, kolom $hidden / ignore).
 */
class TplMetaOrder extends Model {
    protected $table         = 'tpl_meta_orders';
    protected $guarded       = [];
    protected $hidden        = ['secret', 'ghost'];
    protected $appends       = ['label', 'summary', 'optInNumber'];
    protected $configColumns = [
        // Kolom DB nyata + template.
        'code' => ['template' => '<strong>:code</strong><muted>:customer.name|trans</muted>', 'dependsOn' => ['status']],
        // Kolom DB tanpa template: tidak berubah.
        'name' => ['show' => true],
        // Kolom DB hidden + template: tidak boleh diekspos.
        'secret' => ['template' => '<b>:secret</b>'],
        // Kolom virtual hidden (bukan kolom tabel) + template: tidak boleh diekspos.
        'ghost' => ['template' => ':code'],
        // Append opt-in (string) + template.
        'label' => ['dependsOn' => ['code'], 'template' => '<b>:name</b> <muted>:customer.name</muted>', 'searchable' => true],
        // Append tanpa opt-in meski dependsOn terisi.
        'summary' => ['dependsOn' => ['code', 'name']],
        // Append number opt-in, tepat satu dependsOn lokal -> single.
        'optInNumber' => ['type' => 'number', 'dependsOn' => ['qty'], 'searchable' => true],
        // Relasi tunggal ber-template.
        'customer' => ['template' => '<strong>:name</strong>'],
        // Relasi banyak: template tanpa max (tidak ada default injeksi).
        'items' => ['template' => '<strong>:name</strong>'],
        // Relasi banyak: max eksplisit 0 (tanpa batas).
        'lines' => ['max' => 0],
        // Virtual template, dependsOn manual digabung hasil ekstraksi.
        'full_title' => ['template' => '<strong>:code</strong> :customer.name|trans', 'dependsOn' => ['qty']],
        // Virtual template opt-in string.
        'full_title_search' => ['template' => '<strong>:code</strong> :customer.name', 'searchable' => true],
        // Virtual template opt-in tapi tanpa dependsOn sama sekali -> tidak searchable.
        'static_label' => ['template' => '<muted>Statis</muted>', 'searchable' => true],
        // Virtual expression: default searchable & sortable.
        'total_amount' => ['type' => 'currency', 'expression' => 'qty * price'],
        // Virtual expression dengan searchable: false.
        'total_quiet' => ['type' => 'number', 'expression' => 'qty + 1', 'searchable' => false],
        // Progress.
        'per_done' => ['type' => 'progress', 'expression' => 'qty * 100.0 / NULLIF(price, 0)', 'shape' => 'bar'],
        // Number ber-template opt-in, satu dependsOn lokal -> single.
        'qty_view' => ['type' => 'number', 'template' => '<b>:qty</b>', 'searchable' => true],
        // Number opt-in tetapi dua dependsOn tanpa expression -> tidak searchable.
        'qty_multi' => ['type' => 'number', 'template' => '<b>:qty</b> :price', 'searchable' => true],
        // Ignore.
        'ignored_view' => ['template' => '<b>:code</b>', 'ignore' => true],
        // Tanpa template/expression: bukan kolom virtual.
        'plain_extra' => ['type' => 'string'],
    ];

    public static function templateLink() {
        return ':code';
    }

    public static function mobileTemplate(): string {
        return '<stack><nav-link><strong>:code</strong></nav-link><muted>:customer.name</muted><progress value=":per_done"/></stack>';
    }

    public function getLabelAttribute(): string {
        return (string) $this->name;
    }

    public function getSummaryAttribute(): string {
        return (string) $this->code;
    }

    public function getOptInNumberAttribute(): int {
        return (int) $this->qty;
    }

    public function customer(): BelongsTo {
        return $this->belongsTo(TplMetaCustomer::class, 'customer_id');
    }

    public function items(): HasMany {
        return $this->hasMany(TplMetaItem::class, 'order_id');
    }

    public function lines(): HasMany {
        return $this->hasMany(TplMetaItem::class, 'order_id');
    }
}

/** Model tanpa mobileTemplate() dan tanpa konfigurasi baru. */
class TplMetaPlain extends Model {
    protected $table   = 'tpl_meta_customers';
    protected $guarded = [];
}

class TemplateColumnMetadataTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        config(['datatable.config_cache_enabled' => true]);

        Schema::create('tpl_meta_customers', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->nullable();
            $table->timestamps();
        });
        Schema::create('tpl_meta_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });
        Schema::create('tpl_meta_orders', function (Blueprint $table): void {
            $table->id();
            $table->string('code')->nullable();
            $table->string('name')->nullable();
            $table->string('status')->nullable();
            $table->integer('qty')->default(0);
            $table->decimal('price', 12, 2)->default(0);
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('secret')->nullable();
            $table->timestamps();
        });
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function columns(bool $includeIgnore = true): array {
        $out = [];
        foreach (TplMetaOrder::computeColumnsFlat($includeIgnore) as $column) {
            $out[$column['name']] = $column;
        }

        return $out;
    }

    #[Test]
    public function db_column_with_template_unions_manual_and_extracted_depends_on(): void {
        $code = $this->columns()['code'];

        $this->assertSame(['status', 'code', 'customer.name'], $code['dependsOn']);
        $this->assertSame('string', $code['type']);
        $this->assertArrayNotHasKey('virtual', $code);
        $this->assertTrue($code['sortable']);
        $this->assertTrue($code['searchable']);
    }

    #[Test]
    public function db_column_without_template_has_no_depends_on_added(): void {
        $this->assertArrayNotHasKey('dependsOn', $this->columns()['name']);
    }

    #[Test]
    public function virtual_template_column_gets_union_depends_on_and_virtual_flags(): void {
        $col = $this->columns()['full_title'];

        $this->assertTrue($col['virtual']);
        $this->assertTrue($col['derived']);
        $this->assertSame('string', $col['type']);
        $this->assertSame(['qty', 'code', 'customer.name'], $col['dependsOn']);
        $this->assertFalse($col['sortable']);
        $this->assertFalse($col['searchable'], 'tanpa opt-in tidak searchable (D1)');
        $this->assertNull($col['searchVia']);
        $this->assertSame('<strong>:code</strong> :customer.name|trans', $col['template']);
    }

    #[Test]
    public function virtual_template_column_opt_in_is_searchable_via_depends_on(): void {
        $col = $this->columns()['full_title_search'];

        $this->assertSame(['code', 'customer.name'], $col['dependsOn']);
        $this->assertTrue($col['searchable']);
        $this->assertSame('dependsOn', $col['searchVia']);
    }

    #[Test]
    public function opt_in_without_any_depends_on_is_not_searchable(): void {
        $col = $this->columns()['static_label'];

        $this->assertSame([], $col['dependsOn']);
        $this->assertFalse($col['searchable']);
        $this->assertNull($col['searchVia']);
    }

    #[Test]
    public function expression_column_is_sortable_and_searchable_by_default(): void {
        $col = $this->columns()['total_amount'];

        $this->assertTrue($col['virtual']);
        $this->assertSame('currency', $col['type']);
        $this->assertTrue($col['sortable']);
        $this->assertTrue($col['searchable']);
        $this->assertSame('expression', $col['searchVia']);
        $this->assertSame('qty * price', $col['expression']);
    }

    #[Test]
    public function expression_column_can_opt_out_of_search_but_stays_sortable(): void {
        $col = $this->columns()['total_quiet'];

        $this->assertTrue($col['sortable']);
        $this->assertFalse($col['searchable']);
        $this->assertNull($col['searchVia']);
    }

    #[Test]
    public function progress_column_keeps_shape_and_uses_expression_search(): void {
        $col = $this->columns()['per_done'];

        $this->assertSame('progress', $col['type']);
        $this->assertSame('bar', $col['shape']);
        $this->assertTrue($col['sortable']);
        $this->assertTrue($col['searchable']);
        $this->assertSame('expression', $col['searchVia']);
    }

    #[Test]
    public function number_template_column_with_single_local_depends_on_uses_single(): void {
        $col = $this->columns()['qty_view'];

        $this->assertSame(['qty'], $col['dependsOn']);
        $this->assertTrue($col['searchable']);
        $this->assertSame('single', $col['searchVia']);
        $this->assertFalse($col['sortable']);
    }

    #[Test]
    public function number_template_column_with_multiple_depends_on_is_not_searchable(): void {
        $col = $this->columns()['qty_multi'];

        $this->assertSame(['price', 'qty'], $col['dependsOn']);
        $this->assertFalse($col['searchable']);
        $this->assertNull($col['searchVia']);
    }

    #[Test]
    public function attribute_append_search_is_opt_in(): void {
        $columns = $this->columns();

        // Opt-in string + template.
        $this->assertSame('attribute', $columns['label']['type']);
        $this->assertSame(['code', 'customer.name', 'name'], $columns['label']['dependsOn']);
        $this->assertTrue($columns['label']['searchable']);
        $this->assertSame('dependsOn', $columns['label']['searchVia']);
        $this->assertTrue($columns['label']['derived']);
        $this->assertArrayNotHasKey('virtual', $columns['label']);

        // dependsOn terisi tetapi tanpa opt-in.
        $this->assertSame(['code', 'name'], $columns['summary']['dependsOn']);
        $this->assertFalse($columns['summary']['searchable']);
        $this->assertNull($columns['summary']['searchVia']);

        // Append number opt-in, satu dependsOn.
        $this->assertTrue($columns['optInNumber']['searchable']);
        $this->assertSame('single', $columns['optInNumber']['searchVia']);
    }

    #[Test]
    public function relation_columns_get_default_max_and_template_depends_on(): void {
        $columns = $this->columns();

        $this->assertSame('relations', $columns['items']['type']);
        $this->assertArrayNotHasKey('max', $columns['items'], 'max tidak disuntikkan default (opt-in lewat configColumns)');
        $this->assertSame(['name'], $columns['items']['dependsOn']);
        $this->assertSame('<strong>:name</strong>', $columns['items']['template']);
        $this->assertTrue($columns['items']['searchable']);

        $this->assertSame(0, $columns['lines']['max'], 'max eksplisit dipertahankan');
        $this->assertArrayNotHasKey('dependsOn', $columns['lines']);

        // Relasi tunggal ('relation') tidak mendapat max, tapi dependsOn dari template.
        $this->assertSame('relation', $columns['customer']['type']);
        $this->assertArrayNotHasKey('max', $columns['customer']);
        $this->assertSame(['name'], $columns['customer']['dependsOn']);
    }

    #[Test]
    public function hidden_columns_are_never_exposed_through_templates(): void {
        $columns = $this->columns();

        $this->assertArrayNotHasKey('secret', $columns, 'kolom DB $hidden + template');
        $this->assertArrayNotHasKey('ghost', $columns, 'key virtual yang ada di $hidden');
    }

    #[Test]
    public function config_without_template_or_expression_does_not_become_virtual(): void {
        $this->assertArrayNotHasKey('plain_extra', $this->columns());
    }

    #[Test]
    public function ignored_virtual_column_is_dropped_unless_include_ignore(): void {
        $this->assertArrayNotHasKey('ignored_view', $this->columns(false));

        $ignored = $this->columns(true)['ignored_view'];
        $this->assertTrue($ignored['virtual']);
        $this->assertTrue($ignored['ignore']);
        $this->assertFalse($ignored['searchable']);
        $this->assertNull($ignored['searchVia']);
    }

    #[Test]
    public function models_without_new_config_keep_their_column_shape(): void {
        foreach (DataTableConfigCache::flat(Branch::class) as $column) {
            $this->assertArrayNotHasKey('virtual', $column, $column['name']);
            $this->assertArrayNotHasKey('template', $column, $column['name']);
            if (($column['type'] ?? null) === 'attribute') {
                $this->assertFalse($column['searchable'], $column['name']);
                $this->assertNull($column['searchVia'], $column['name']);
            }
        }
    }

    #[Test]
    public function meta_warm_writes_and_forget_removes_the_meta_entry(): void {
        $key = DataTableConfigCache::cacheKey(TplMetaOrder::class, DataTableConfigCache::signatureFor(TplMetaOrder::class)) . ':meta';

        DataTableConfigCache::forget(TplMetaOrder::class);
        $this->assertFalse(Cache::has($key));

        DataTableConfigCache::warm(TplMetaOrder::class);

        $this->assertTrue(Cache::has($key));
        $expected = [
            'mobileTemplate'  => TplMetaOrder::mobileTemplate(),
            'mobileDependsOn' => ['code', 'customer.name', 'per_done'],
        ];
        $this->assertSame($expected, Cache::get($key));
        $this->assertSame($expected, DataTableConfigCache::meta(TplMetaOrder::class));

        DataTableConfigCache::forget(TplMetaOrder::class);

        $this->assertFalse(Cache::has($key), 'forget() menghapus meta');
        $this->assertFalse(Cache::has(substr($key, 0, -5)), 'forget() tetap menghapus flat');
    }

    #[Test]
    public function meta_is_recomputed_after_forget(): void {
        DataTableConfigCache::warm(TplMetaOrder::class);
        DataTableConfigCache::forget(TplMetaOrder::class);

        $this->assertSame(TplMetaOrder::mobileTemplate(), DataTableConfigCache::meta(TplMetaOrder::class)['mobileTemplate']);
    }

    #[Test]
    public function meta_is_empty_for_models_without_mobile_template(): void {
        DataTableConfigCache::warm(TplMetaPlain::class);

        $this->assertSame(
            ['mobileTemplate' => null, 'mobileDependsOn' => []],
            DataTableConfigCache::meta(TplMetaPlain::class),
        );
    }

    #[Test]
    public function meta_works_with_cache_disabled(): void {
        config(['datatable.config_cache_enabled' => false]);

        $this->assertSame(TplMetaOrder::mobileTemplate(), DataTableConfigCache::meta(TplMetaOrder::class)['mobileTemplate']);
    }

    #[Test]
    public function flat_shape_is_unchanged_by_meta(): void {
        $flat = DataTableConfigCache::warm(TplMetaOrder::class);

        $this->assertSame($flat, DataTableConfigCache::flat(TplMetaOrder::class));
        $this->assertArrayNotHasKey('mobileTemplate', $flat);
    }
}

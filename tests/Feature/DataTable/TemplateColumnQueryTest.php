<?php

namespace Tests\Feature\DataTable;

use App\Models\Model as AppModel;
use App\Services\Core\DataTable\Template\ExpressionSql;
use App\Services\Core\DataTableColumnSelector;
use App\Services\Core\FilterColumnResolver;
use App\Services\Core\FilterEvaluator;
use App\Services\Core\FilterTreeCleaner;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TqtCategory extends AppModel {
    protected $table   = 'tqt_categories';
    protected $guarded = ['id'];
    public $timestamps = false;

    public static function templateLink() {
        return ':title';
    }
}

class TqtCustomer extends AppModel {
    protected $table   = 'tqt_customers';
    protected $guarded = ['id'];
    public $timestamps = false;

    public static function templateLink() {
        return ':name';
    }
}

class TqtItem extends AppModel {
    protected $table   = 'tqt_items';
    protected $guarded = ['id'];
    public $timestamps = false;

    public static function templateLink() {
        return ':name';
    }

    public function category(): BelongsTo {
        return $this->belongsTo(TqtCategory::class, 'category_id');
    }
}

/**
 * Model fixture: kolom template (virtual), expression (currency/progress), Attribute opt-in &
 * non-opt-in, relasi banyak ber-template, dan `mobileTemplate()`.
 */
class TqtOrder extends AppModel {
    use DataTable;

    protected $table               = 'tqt_orders';
    protected $guarded             = ['id'];
    protected $appends             = ['title_view', 'plain_attr'];
    protected array $configColumns = [
        'code' => ['show' => true, 'order' => 0, 'groupable' => true],
        // Kolom DB nyata ber-template: dependsOn hasil template TIDAK boleh dianggap accessor.
        'name'     => ['show' => true, 'order' => 1, 'template' => '<strong>:name</strong><muted>:code</muted>'],
        'qty'      => ['show' => true, 'order' => 2, 'type' => 'number'],
        'price'    => ['show' => true, 'order' => 3, 'type' => 'number'],
        'customer' => ['show' => true, 'order' => 4],
        'items'    => ['show' => true, 'order' => 5, 'template' => '<strong>:name</strong>', 'max' => 2],
        // Relasi banyak TANPA template/max: perilaku lama (child-select dari templateLink anak).
        'lines' => ['show' => false, 'order' => 11],
        // Virtual template (string, opt-in) lewat kolom lokal + relasi.
        'summary_view' => ['show' => true, 'order' => 6, 'template' => '<strong>:code</strong> <muted>:customer.name</muted>', 'searchable' => true],
        // Virtual template tanpa opt-in pencarian.
        'quiet_view' => ['show' => true, 'order' => 7, 'template' => '<muted>:name</muted>'],
        // Virtual template dengan relasi bersarang melewati has-many.
        'deep_view'    => ['show' => false, 'order' => 8, 'template' => '<muted>:items.category.title</muted>'],
        'total_amount' => ['show' => true, 'order' => 9, 'type' => 'currency', 'expression' => 'qty * price'],
        'per_done'     => ['show' => true, 'order' => 10, 'type' => 'progress', 'expression' => 'qty * 100.0 / NULLIF(price, 0)'],
        'title_view'   => ['show' => false, 'dependsOn' => ['code', 'name'], 'searchable' => true],
        'plain_attr'   => ['show' => false, 'dependsOn' => ['code', 'name']],
    ];

    public static function templateLink() {
        return ':code';
    }

    protected function titleView(): Attribute {
        return Attribute::make(get: fn () => $this->code . ' / ' . $this->name);
    }

    protected function plainAttr(): Attribute {
        return Attribute::make(get: fn () => $this->code);
    }

    public function customer(): BelongsTo {
        return $this->belongsTo(TqtCustomer::class, 'customer_id');
    }

    public function items(): HasMany {
        return $this->hasMany(TqtItem::class, 'order_id');
    }

    public function lines(): HasMany {
        return $this->hasMany(TqtItem::class, 'order_id');
    }
}

/** TqtOrder + `mobileTemplate()` (model tanpa metode ini tak boleh kena dependensi mobile). */
class TqtMobileOrder extends TqtOrder {
    public static function mobileTemplate(): string {
        return '<stack><strong>:code</strong><muted>:customer.city</muted><progress value=":per_done" shape="bar"/></stack>';
    }
}

/** Model tanpa konfigurasi/metode baru (Property 10). */
class TqtPlain extends AppModel {
    use DataTable;

    protected $table               = 'tqt_plains';
    protected $guarded             = ['id'];
    protected array $configColumns = [
        'name' => ['show' => true, 'order' => 0],
    ];

    public static function templateLink() {
        return ':name';
    }
}

class TemplateColumnQueryTest extends TestCase {
    use RefreshDatabase;

    private TqtOrder $orderA;
    private TqtOrder $orderB;
    private TqtOrder $orderC;

    protected function setUp(): void {
        parent::setUp();

        foreach (['users', 'preferences'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        Schema::create('tqt_categories', function ($t) {
            $t->id();
            $t->string('title')->nullable();
        });
        Schema::create('tqt_customers', function ($t) {
            $t->id();
            $t->string('name')->nullable();
            $t->string('city')->nullable();
        });
        Schema::create('tqt_items', function ($t) {
            $t->id();
            $t->unsignedBigInteger('order_id')->nullable();
            $t->unsignedBigInteger('category_id')->nullable();
            $t->string('name')->nullable();
            $t->string('note')->nullable();
        });
        Schema::create('tqt_orders', function ($t) {
            $t->id();
            $t->string('code')->nullable();
            $t->string('name')->nullable();
            $t->integer('qty')->default(0);
            $t->decimal('price', 12, 2)->default(0);
            $t->unsignedBigInteger('customer_id')->nullable();
            $t->boolean('is_example')->default(false);
            $t->timestamps();
        });
        Schema::create('tqt_plains', function ($t) {
            $t->id();
            $t->string('name')->nullable();
            $t->boolean('is_example')->default(false);
            $t->timestamps();
        });

        $hardware = TqtCategory::create(['title' => 'Hardware']);
        $parts    = TqtCategory::create(['title' => 'Parts']);
        $acme     = TqtCustomer::create(['name' => 'Acme', 'city' => 'Jakarta']);
        $budi     = TqtCustomer::create(['name' => 'Budi', 'city' => 'Bandung']);

        $this->orderA = TqtOrder::create(['code' => 'ORD-A', 'name' => 'Alpha', 'qty' => 2, 'price' => 50, 'customer_id' => $acme->id]);
        $this->orderB = TqtOrder::create(['code' => 'ORD-B', 'name' => 'Beta', 'qty' => 1, 'price' => 30, 'customer_id' => $budi->id]);
        $this->orderC = TqtOrder::create(['code' => 'ORD-C', 'name' => 'Gamma', 'qty' => 10, 'price' => 0]);

        TqtItem::create(['order_id' => $this->orderA->id, 'category_id' => $hardware->id, 'name' => 'Bolt', 'note' => 'steel']);
        TqtItem::create(['order_id' => $this->orderA->id, 'category_id' => $hardware->id, 'name' => 'Nut', 'note' => 'brass']);
        TqtItem::create(['order_id' => $this->orderB->id, 'category_id' => $parts->id, 'name' => 'Gear', 'note' => 'iron']);
    }

    // ---- helpers --------------------------------------------------------

    private function inertiaRequest(array $query = [], array $cookies = []): Request {
        return Request::create('/tqt-orders', 'GET', $query, $cookies);
    }

    private function ajax(array $query = [], array $cookies = []): Request {
        return Request::create('/tqt-orders', 'GET', $query, $cookies, server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
    }

    /** @param list<string> $columns */
    private function visibleCookie(array $columns): array {
        return ['datatable_columns_tqt_orders' => json_encode(array_fill_keys($columns, true))];
    }

    /** @return list<TqtOrder> */
    private function rows(array $query = [], array $cookies = [], string $model = TqtOrder::class): array {
        return array_values($model::dataTable($this->ajax($query, $cookies))['data']->items());
    }

    /**
     * @param  list<array<string, mixed>>  $items  item filter {k,o,v}
     * @return list<string> kode order hasil filter (terurut)
     */
    private function filterCodes(array $items, bool $allowNonSearchable = false, ?string $model = TqtOrder::class): array {
        $query = $model::query();
        (new FilterEvaluator($model::getColumns(1), $allowNonSearchable))
            ->apply($query, ['root' => ['k' => 'and', 'c' => $items]]);

        return $query->orderBy('code')->pluck('code')->all();
    }

    // ---- 4.1/4.2: kolom virtual, dependensi, select ---------------------

    #[Test]
    public function virtual_template_column_selects_dependencies_and_eager_loads_relations_without_set_appends(): void {
        $rows = $this->rows(['sort' => 'code'], $this->visibleCookie(['summary_view']));
        $row  = $rows[0];

        $this->assertSame('ORD-A', $row->code, 'dependensi lokal (code) ikut SELECT');
        $this->assertArrayHasKey('customer_id', $row->getAttributes(), 'FK relasi ikut SELECT');
        $this->assertArrayNotHasKey('qty', $row->getAttributes(), 'kolom tak dirujuk tidak ikut SELECT');
        $this->assertTrue($row->relationLoaded('customer'));
        $this->assertSame('Acme', $row->customer->name);
        $this->assertArrayNotHasKey('city', $row->customer->getAttributes(), 'child-select presisi (city tak dirujuk)');
        $this->assertNotContains('summary_view', $row->getAppends(), 'kolom virtual tak boleh masuk setAppends');
        $this->assertNotContains('summary_view', array_keys($row->toArray()));
        $this->assertFalse($rows[2]->relationLoaded('customer') && $rows[2]->customer !== null);
    }

    #[Test]
    public function physical_column_with_template_is_selected_but_never_appended_as_an_accessor(): void {
        $rows = $this->rows(['sort' => 'code'], $this->visibleCookie(['name']));
        $row  = $rows[0];

        $this->assertSame('Alpha', $row->name);
        $this->assertSame('ORD-A', $row->code, ':code dari template ikut SELECT');
        $this->assertNotContains('name', $row->getAppends(), 'kolom fisik ber-template bukan accessor (setAppends)');
        $this->assertSame('Alpha', $row->toArray()['name'], 'serialisasi baris tidak memanggil getNameAttribute()');
    }

    #[Test]
    public function nested_template_path_through_has_many_is_eager_loaded_precisely(): void {
        $rows = $this->rows(['sort' => 'code'], $this->visibleCookie(['deep_view']));
        $row  = $rows[0];

        $this->assertTrue($row->relationLoaded('items'));
        $this->assertCount(2, $row->items);
        $item = $row->items->first();
        $this->assertArrayHasKey('category_id', $item->getAttributes(), 'FK relasi bersarang ikut SELECT anak');
        $this->assertTrue($item->relationLoaded('category'));
        $this->assertSame('Hardware', $item->category->title);
    }

    #[Test]
    public function relations_column_with_template_selects_only_template_columns_of_children(): void {
        $rows = $this->rows(['sort' => 'code'], $this->visibleCookie(['items']));
        $item = $rows[0]->items->first();

        $this->assertArrayHasKey('name', $item->getAttributes());
        $this->assertArrayHasKey('order_id', $item->getAttributes(), 'FK has-many wajib untuk hidrasi');
        $this->assertArrayNotHasKey('note', $item->getAttributes(), 'kolom di luar template tak ikut');
        $this->assertArrayNotHasKey('category_id', $item->getAttributes());
    }

    #[Test]
    public function relations_column_without_template_or_max_keeps_the_legacy_eager_load(): void {
        $columns = collect(TqtOrder::getColumns(1))->keyBy('name');
        $this->assertArrayNotHasKey('max', $columns['lines'], 'tanpa opt-in tidak ada max di metadata');
        $this->assertArrayNotHasKey('template', $columns['lines']);

        $row  = $this->rows(['sort' => 'code'], $this->visibleCookie(['lines']))[0];
        $item = $row->lines->first();

        // Jalur lama: kolom child = templateLink anak (name) + PK + FK has-many; tanpa kolom lain.
        $this->assertEqualsCanonicalizing(['id', 'name', 'order_id'], array_keys($item->getAttributes()));
        $this->assertFalse($item->relationLoaded('category'), 'tak ada relasi tambahan yang dimuat');
    }

    #[Test]
    public function selector_returns_empty_new_outputs_for_a_model_without_new_config(): void {
        $columns  = TqtPlain::getColumns(1);
        $selector = new DataTableColumnSelector(new FilterColumnResolver($columns));
        $resolved = $selector->resolveForSafe($columns, new TqtPlain, ['name' => true], [], ':name');

        $this->assertSame([], $resolved['selectRaw']);
        $this->assertSame([], $resolved['appends']);
        $this->assertSame(['tqt_plains.id', 'tqt_plains.name'], $resolved['select']);
    }

    // ---- expression: nilai, sort, select --------------------------------

    #[Test]
    public function expression_values_are_in_each_row_keyed_by_column_name(): void {
        $rows = collect($this->rows(['sort' => 'code']))->keyBy('code');

        $this->assertEquals(100, $rows['ORD-A']->total_amount);
        $this->assertEquals(30, $rows['ORD-B']->total_amount);
        $this->assertEquals(0, $rows['ORD-C']->total_amount);
        $this->assertEquals(4, $rows['ORD-A']->per_done);
        $this->assertEquals(3.33, $rows['ORD-B']->per_done);
        $this->assertNull($rows['ORD-C']->per_done, 'pembagi nol -> NULL');
    }

    #[Test]
    public function expression_columns_are_sortable_asc_and_desc(): void {
        $asc  = array_map(fn ($row) => $row->code, $this->rows(['sort' => 'total_amount']));
        $desc = array_map(fn ($row) => $row->code, $this->rows(['sort' => '-total_amount']));

        $this->assertSame(['ORD-C', 'ORD-B', 'ORD-A'], $asc);
        $this->assertSame(['ORD-A', 'ORD-B', 'ORD-C'], $desc);
    }

    #[Test]
    public function expression_column_that_is_not_visible_can_still_sort(): void {
        $codes = array_map(fn ($row) => $row->code, $this->rows(['sort' => '-total_amount'], $this->visibleCookie(['code'])));

        $this->assertSame(['ORD-A', 'ORD-B', 'ORD-C'], $codes);
    }

    #[Test]
    public function mobile_template_dependencies_are_always_selected_including_expression_columns(): void {
        $rows = $this->rows(['sort' => 'code'], $this->visibleCookie(['name']), TqtMobileOrder::class);
        $row  = $rows[0];

        $this->assertSame('ORD-A', $row->code, ':code dari mobileTemplate()');
        $this->assertTrue($row->relationLoaded('customer'));
        $this->assertSame('Jakarta', $row->customer->city, ':customer.city dari mobileTemplate()');
        $this->assertEquals(4, $row->per_done, ':per_done (kolom expression) dari mobileTemplate()');
        $this->assertArrayNotHasKey('total_amount', $row->getAttributes(), 'expression yang tak dirujuk & tak visible tak ikut');
    }

    // ---- 4.3: filter expression -----------------------------------------

    #[Test]
    public function expression_filter_supports_comparison_between_in_and_set(): void {
        $this->assertSame(['ORD-A', 'ORD-B'], $this->filterCodes([['k' => 'total_amount', 'o' => '>', 'v' => 20]]));
        $this->assertSame(['ORD-B'], $this->filterCodes([['k' => 'total_amount', 'o' => 'between', 'v' => [20, 50]]]));
        $this->assertSame(['ORD-A', 'ORD-C'], $this->filterCodes([['k' => 'total_amount', 'o' => 'in', 'v' => [0, 100]]]));
        $this->assertSame(['ORD-B'], $this->filterCodes([['k' => 'total_amount', 'o' => '!in', 'v' => [0, 100]]]));
        $this->assertSame(['ORD-A', 'ORD-B'], $this->filterCodes([['k' => 'total_amount', 'o' => '>=', 'v' => '30']]), 'angka sebagai string tetap numerik');
        $this->assertSame(['ORD-A', 'ORD-B'], $this->filterCodes([['k' => 'per_done', 'o' => '>', 'v' => 0]]), 'progress memakai ekspresi clamp; NULL tak cocok');
        $this->assertSame(['ORD-A', 'ORD-B'], $this->filterCodes([['k' => 'per_done', 'o' => 'set', 'v' => null]]));
        $this->assertSame(['ORD-C'], $this->filterCodes([['k' => 'per_done', 'o' => '!set', 'v' => null]]));
    }

    #[Test]
    public function expression_filter_values_are_bindings_never_in_sql(): void {
        $query = TqtOrder::query();
        (new FilterEvaluator(TqtOrder::getColumns(1)))->apply($query, ['root' => ['k' => 'and', 'c' => [
            ['k' => 'total_amount', 'o' => '>', 'v' => 987654],
            ['k' => 'total_amount', 'o' => 'between', 'v' => [111222, 333444]],
            ['k' => 'total_amount', 'o' => 'in', 'v' => [555666, 777888]],
        ]]]);

        $sql = $query->toSql();
        foreach (['987654', '111222', '333444', '555666', '777888'] as $value) {
            $this->assertStringNotContainsString($value, $sql);
        }
        foreach ([987654, 111222, 333444, 555666, 777888] as $value) {
            $this->assertContains($value, $query->getBindings(), "{$value} harus berupa binding");
        }
        $this->assertStringContainsString('qty * price', $sql, 'ekspresi developer ada di SQL');
    }

    #[Test]
    public function expression_filter_ignores_non_numeric_values_instead_of_injecting(): void {
        $payload = '1) OR 1=1 --';
        $query   = TqtOrder::query();
        (new FilterEvaluator(TqtOrder::getColumns(1)))->apply($query, ['root' => ['k' => 'and', 'c' => [
            ['k' => 'total_amount', 'o' => '>', 'v' => $payload],
            ['k' => 'total_amount', 'o' => 'in', 'v' => [$payload]],
        ]]]);

        $this->assertStringNotContainsString('1=1', $query->toSql());
        $this->assertCount(3, $query->get(), 'item dengan nilai non-numerik diabaikan (tak menyaring)');
    }

    #[Test]
    public function expression_column_can_opt_out_of_search_with_searchable_false(): void {
        $columns = collect(TqtOrder::getColumns(1))->keyBy('name');

        $this->assertSame('expression', $columns['total_amount']['searchVia']);
        $this->assertTrue($columns['total_amount']['searchable']);
    }

    // ---- 4.3: Attribute / virtual string --------------------------------

    #[Test]
    public function attribute_matches_and_not_matches_search_dependencies_locally(): void {
        $this->assertSame(['ORD-A'], $this->filterCodes([['k' => 'title_view', 'o' => 'matches', 'v' => 'alph']]));
        $this->assertSame(['ORD-B'], $this->filterCodes([['k' => 'title_view', 'o' => 'matches', 'v' => 'ORD-B']]), 'cocok di salah satu kolom dependsOn (code)');
        $this->assertSame(['ORD-B', 'ORD-C'], $this->filterCodes([['k' => 'title_view', 'o' => '!matches', 'v' => 'alph']]));
    }

    #[Test]
    public function attribute_set_and_not_set_check_whether_any_dependency_is_filled(): void {
        TqtOrder::create(['code' => null, 'name' => null, 'qty' => 0, 'price' => 0]);
        TqtOrder::create(['code' => '', 'name' => 'Only name', 'qty' => 0, 'price' => 0]);

        $set    = $this->filterCodes([['k' => 'title_view', 'o' => 'set', 'v' => null]]);
        $notSet = TqtOrder::query();
        (new FilterEvaluator(TqtOrder::getColumns(1)))->apply($notSet, ['root' => ['k' => 'and', 'c' => [['k' => 'title_view', 'o' => '!set', 'v' => null]]]]);

        $this->assertSame(['', 'ORD-A', 'ORD-B', 'ORD-C'], $set, 'minimal satu dependsOn terisi (kode kosong tapi nama terisi tetap set)');
        $this->assertCount(1, $notSet->get(), 'semua dependsOn kosong');
        $this->assertNull($notSet->first()->code);
    }

    #[Test]
    public function virtual_template_column_searches_relation_dependencies_with_where_has(): void {
        $this->assertSame(['ORD-A'], $this->filterCodes([['k' => 'summary_view', 'o' => 'matches', 'v' => 'acme']]), 'cocok lewat relasi customer.name');
        $this->assertSame(['ORD-B'], $this->filterCodes([['k' => 'summary_view', 'o' => 'matches', 'v' => 'ORD-B']]), 'cocok lewat kolom lokal code');
        $this->assertSame(['ORD-B', 'ORD-C'], $this->filterCodes([['k' => 'summary_view', 'o' => '!matches', 'v' => 'acme']]));
        $this->assertSame(['ORD-A', 'ORD-B', 'ORD-C'], $this->filterCodes([['k' => 'summary_view', 'o' => 'set', 'v' => null]]));
    }

    #[Test]
    public function attribute_without_opt_in_is_ignored_even_when_non_searchable_is_allowed(): void {
        $item = [['k' => 'plain_attr', 'o' => 'matches', 'v' => 'zzz']];

        $this->assertSame(['ORD-A', 'ORD-B', 'ORD-C'], $this->filterCodes($item));
        $this->assertSame(['ORD-A', 'ORD-B', 'ORD-C'], $this->filterCodes($item, true));
        $this->assertSame(['ORD-A', 'ORD-B', 'ORD-C'], $this->filterCodes([['k' => 'quiet_view', 'o' => 'matches', 'v' => 'zzz']], true));
    }

    #[Test]
    public function attribute_and_virtual_string_columns_only_accept_matches_and_set_operators(): void {
        $all = ['ORD-A', 'ORD-B', 'ORD-C'];

        $this->assertSame($all, $this->filterCodes([['k' => 'title_view', 'o' => '=', 'v' => 'Alpha']]));
        $this->assertSame($all, $this->filterCodes([['k' => 'summary_view', 'o' => 'starts_with', 'v' => 'ORD']]));
    }

    // ---- 4.3: relations matches -----------------------------------------

    #[Test]
    public function relations_matches_searches_child_template_columns_with_where_has(): void {
        $this->assertSame(['ORD-A'], $this->filterCodes([['k' => 'items', 'o' => 'matches', 'v' => 'bolt']]));
        $this->assertSame(['ORD-B'], $this->filterCodes([['k' => 'items', 'o' => 'matches', 'v' => 'gear']]));
        $this->assertSame(['ORD-B', 'ORD-C'], $this->filterCodes([['k' => 'items', 'o' => '!matches', 'v' => 'bolt']]), 'tak ada anak yang cocok (termasuk tanpa anak)');
    }

    #[Test]
    public function relations_set_and_not_set_mean_has_or_has_no_children(): void {
        $this->assertSame(['ORD-A', 'ORD-B'], $this->filterCodes([['k' => 'items', 'o' => 'set', 'v' => null]]));
        $this->assertSame(['ORD-C'], $this->filterCodes([['k' => 'items', 'o' => '!set', 'v' => null]]));
    }

    #[Test]
    public function filter_tree_cleaner_keeps_new_operators(): void {
        $cleaner = new FilterTreeCleaner(TqtOrder::getColumns(1));
        $valid   = fn (array $item): bool => $cleaner->hasValidItems($cleaner->clean(['root' => ['k' => 'and', 'c' => ['a' => $item]]]));

        $this->assertTrue($valid(['k' => 'title_view', 'o' => 'matches', 'v' => 'x']));
        $this->assertTrue($valid(['k' => 'items', 'o' => 'matches', 'v' => 'x']));
        $this->assertTrue($valid(['k' => 'per_done', 'o' => '>', 'v' => 5]));
        $this->assertFalse($valid(['k' => 'plain_attr', 'o' => 'matches', 'v' => 'x']), 'plainAttr (tanpa opt-in) dibuang');
    }

    // ---- 4.2: share Inertia ---------------------------------------------

    #[Test]
    public function inertia_share_has_no_expression_key_and_includes_mobile_template(): void {
        TqtMobileOrder::dataTable($this->inertiaRequest());

        $columns = Inertia::getShared('dataTableColumns');
        $names   = array_column($columns, 'name');

        $this->assertContains('total_amount', $names);
        foreach ($columns as $column) {
            $this->assertArrayNotHasKey('expression', $column, $column['name']);
        }
        $this->assertSame(TqtMobileOrder::mobileTemplate(), Inertia::getShared('mobileTemplate'));
    }

    #[Test]
    public function inertia_share_mobile_template_is_null_for_models_without_it(): void {
        TqtPlain::create(['name' => 'x']);
        TqtPlain::dataTable(Request::create('/tqt-plains', 'GET'));

        $this->assertNull(Inertia::getShared('mobileTemplate'));

        TqtOrder::dataTable($this->inertiaRequest());
        $this->assertNull(Inertia::getShared('mobileTemplate'), 'TqtOrder tak punya mobileTemplate()');
    }

    #[Test]
    public function single_record_response_columns_have_no_expression_key(): void {
        $result = TqtOrder::dataTable($this->ajax(['id' => $this->orderA->id]));

        foreach ($result['dataTableColumns'] as $column) {
            $this->assertArrayNotHasKey('expression', $column, $column['name']);
        }
        $this->assertEquals(100, $result['data']->total_amount);
    }

    // ---- R1: pohon grup + expression ------------------------------------

    #[Test]
    public function group_tree_works_on_a_model_with_expression_columns(): void {
        TqtOrder::create(['code' => 'ORD-A', 'name' => 'Alpha 2', 'qty' => 1, 'price' => 10]);

        TqtOrder::dataTable($this->inertiaRequest(['group' => 'code', 'sort' => '-total_amount']));
        $groups = collect(Inertia::getShared('data')->items())->pluck('count', 'key')->all();

        ksort($groups);
        $this->assertSame(['ORD-A' => 2, 'ORD-B' => 1, 'ORD-C' => 1], $groups);

        try {
            TqtOrder::dataTable($this->ajax(['group' => 'code', 'groupPath' => json_encode(['ORD-A']), 'sort' => '-total_amount']));
            $this->fail('expand harus melempar HttpResponseException');
        } catch (HttpResponseException $e) {
            $payload = $e->getResponse()->getData(true);
        }

        $this->assertSame('rows', $payload['type']);
        $this->assertSame([100.0, 10.0], array_map('floatval', array_column($payload['data'], 'total_amount')), 'baris daun memuat nilai expression, urut menurun');
    }

    #[Test]
    public function group_query_resets_select_so_expression_columns_never_reach_group_by(): void {
        DB::enableQueryLog();
        TqtOrder::dataTable($this->inertiaRequest(['group' => 'code']));
        $queries = collect(DB::getQueryLog())->pluck('query')->filter(fn ($q) => stripos($q, 'group by') !== false)->implode(' | ');
        DB::disableQueryLog();

        $this->assertNotSame('', $queries, 'query grup harus berjalan');
        $this->assertStringNotContainsString('qty * price', $queries);
        $this->assertStringNotContainsString('NULLIF', $queries);
    }

    // ---- Property 10: kompatibilitas ------------------------------------

    #[Test]
    public function model_without_new_config_runs_the_same_query_as_before(): void {
        TqtPlain::create(['name' => 'B']);
        TqtPlain::create(['name' => 'A']);

        DB::enableQueryLog();
        TqtPlain::dataTable($this->ajax(['sort' => 'name']));
        $log = DB::getQueryLog();
        DB::disableQueryLog();

        $select = collect($log)->pluck('query')->first(fn ($q) => str_starts_with($q, 'select') && str_contains($q, 'from "tqt_plains"'));

        $this->assertSame(
            'select "tqt_plains"."id", "tqt_plains"."name" from "tqt_plains" where "tqt_plains"."is_example" = ? order by "tqt_plains"."name" asc limit 25 offset 0',
            $select,
        );
    }

    #[Test]
    public function expression_sql_class_matches_what_the_scope_uses(): void {
        $column = collect(TqtOrder::getColumns(1))->firstWhere('name', 'total_amount');

        $this->assertSame('(qty * price)', ExpressionSql::forColumn($column));
    }
}

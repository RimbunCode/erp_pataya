<?php

namespace Tests\Feature\Models\Scopes;

use App\Casts\FormStatusCast;
use App\Casts\FormStatusesCast;
use App\Enums\FormStatus;
use App\Models\Core\SavedFilter;
use App\Models\Model as AppModel;
use App\Models\User\User;
use App\Services\Core\DataTable\Group\GroupColumnGate;
use App\Services\Core\DataTable\Group\GroupLevelResolver;
use App\Services\Core\DataTable\Group\ResolvedGroupLevel;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DtgCustomerStub extends AppModel {
    protected $table   = 'dtg_customers';
    protected $guarded = ['id'];
    public $timestamps = false;
}

/**
 * Model stub dgn kolom: 'name' (default sortable, tidak groupable), 'category'
 * (groupable), 'locked_field' (sortable:false, utk gate Requirement 2),
 * relasi 'customer' (BelongsTo, groupable:true -- FK-nya ('customer_id') ada
 * di tabel model INI sendiri, jadi DIDUKUNG), relasi 'primaryContact' (HasOne,
 * groupable KELIRU diset true -- FK-nya ada di tabel LAIN, harus tetap
 * ditolak), dan 'tags' (type di-override jadi 'json' via config, groupable
 * KELIRU diset true -- Cell.jsx render blank utk type ini, harus ditolak).
 */
class DtgRecord extends AppModel {
    use DataTable;

    protected $table   = 'dtg_records';
    protected $guarded = ['id'];
    protected $casts   = [
        // Cast yg SAMA persis dipakai Submitable::initializeSubmitable()
        // (mergeCasts 'status' => FormStatusesCast::class) -- langsung
        // dideklarasikan di sini (bukan pakai trait Submitable penuh) supaya
        // stub tetap sederhana, cukup exercise type-detection & storage-nya.
        'statuses' => FormStatusesCast::class,
    ];
    protected array $configColumns = [
        'name'           => ['show' => true, 'order' => 0],
        'category'       => ['show' => true, 'order' => 1, 'groupable' => true],
        'locked_field'   => ['show' => true, 'order' => 2, 'sortable' => false],
        'customer'       => ['show' => true, 'order' => 3, 'groupable' => true],
        'primaryContact' => ['show' => true, 'order' => 4, 'groupable' => true],
        'tags'           => ['show' => true, 'order' => 5, 'type' => 'json', 'groupable' => true],
        'notes'          => ['show' => true, 'order' => 9, 'type' => 'html', 'groupable' => true],
        'due_date'       => ['show' => true, 'order' => 6, 'type' => 'date', 'groupable' => true],
        'amount'         => ['show' => true, 'order' => 7, 'type' => 'number', 'groupable' => true, 'groupRangeOptions' => [10, 100]],
        'is_active'      => ['show' => true, 'order' => 8, 'type' => 'boolean', 'groupable' => true],
        'statuses'       => ['show' => true, 'order' => 10, 'groupable' => true],
    ];

    public function customer(): BelongsTo {
        return $this->belongsTo(DtgCustomerStub::class, 'customer_id');
    }

    public function primaryContact(): HasOne {
        return $this->hasOne(DtgCustomerStub::class, 'primary_contact_of_record_id');
    }

    public static function templateLink() {
        return ':name';
    }
}

/**
 * Model dgn default group 'category' (kolom groupable). Sengaja subclass
 * terpisah, bukan properti di DtgRecord -- kalau tidak, SEMUA test lain di file
 * ini ikut ter-grup otomatis. Properti dideklarasikan di kelas model (bukan
 * trait DataTable): PHP fatal kalau kelas yg `use` trait mendeklarasi ulang
 * properti statis trait dgn nilai beda.
 */
class DtgDefaultGroupRecord extends DtgRecord {
    protected static array|string|null $defaultGroups = 'category';
}

/**
 * Relasi MorphTo yg KELIRU diset groupable:true. Laravel: MorphTo extends
 * BelongsTo, jadi lolos `instanceof BelongsTo` polos -- padahal FK-nya cuma
 * separuh kunci (id tanpa owner_type).
 */
class DtgMorphRecord extends DtgRecord {
    protected array $configColumns = [
        'owner' => ['show' => true, 'order' => 0, 'groupable' => true],
    ];

    public function owner(): MorphTo {
        return $this->morphTo('owner');
    }
}

/**
 * Kolom TURUNAN (accessor + $appends + dependsOn) yg KELIRU diset groupable:true
 * -- persis pola ApprovalScheme::status / PaymentSchedule::status. Bukan kolom
 * SQL, jadi GROUP BY/ORDER BY ke situ error "no such column". `type` sengaja
 * di-override ke 'string' (bukan 'attribute') supaya HANYA `dependsOn` yg
 * bisa membedakannya dari kolom fisik.
 */
class DtgDerivedRecord extends DtgRecord {
    protected $appends             = ['name_upper'];
    protected array $configColumns = [
        'name_upper' => ['show' => true, 'order' => 0, 'type' => 'string', 'groupable' => true, 'dependsOn' => ['name']],
    ];

    protected function nameUpper(): Attribute {
        return Attribute::make(get: fn () => \strtoupper((string) $this->name));
    }
}

/**
 * Kolom FISIK yg punya `dependsOn` (persis PurchaseRequest::status -- dependsOn
 * memuat dirinya sendiri + kolom lain krn tampilannya dihitung dari item).
 * TETAP kolom SQL, jadi TETAP boleh di-group: `dependsOn` BUKAN penanda turunan.
 */
class DtgPhysicalWithDependsOnRecord extends DtgRecord {
    protected array $configColumns = [
        'category' => ['show' => true, 'order' => 0, 'groupable' => true, 'dependsOn' => ['category', 'name']],
    ];
}

/** Model NON-Submitable dgn `status` tunggal ber-cast FormStatusCast (spt Ticket/User). */
class DtgSingleStatusRecord extends DtgRecord {
    protected $casts = [
        'status' => FormStatusCast::class,
    ];
}

/** Default group SALAH: 'name' tidak groupable -- harus diabaikan diam-diam. */
class DtgBadDefaultGroupRecord extends DtgRecord {
    protected static array|string|null $defaultGroups = 'name';
}

/**
 * Agregat baris grup (`groupAggregate`): 4 kolom valid (sum/avg/min/max) +
 * 5 config KELIRU yg harus diabaikan diam-diam -- fungsi di luar whitelist,
 * tipe string, kolom TURUNAN (accessor + $appends), relasi, dan `null`.
 */
class DtgAggregateRecord extends DtgRecord {
    protected $appends             = ['double_amount'];
    protected array $configColumns = [
        'name'          => ['show' => true, 'order' => 0, 'groupAggregate' => 'sum'], // string -> ditolak
        'category'      => ['show' => true, 'order' => 1, 'groupable' => true],
        'due_date'      => ['show' => true, 'order' => 2, 'type' => 'date', 'groupable' => true],
        'is_active'     => ['show' => true, 'order' => 3, 'type' => 'boolean', 'groupable' => true],
        'customer'      => ['show' => true, 'order' => 4, 'groupable' => true, 'groupAggregate' => 'sum'], // relasi -> ditolak
        'statuses'      => ['show' => true, 'order' => 5, 'groupable' => true],
        'amount'        => ['show' => true, 'order' => 6, 'type' => 'number', 'groupable' => true, 'groupRangeOptions' => [10, 100], 'groupAggregate' => 'sum'],
        'qty'           => ['show' => true, 'order' => 7, 'type' => 'number', 'groupAggregate' => 'avg'],
        'price'         => ['show' => true, 'order' => 8, 'type' => 'currency', 'groupAggregate' => 'min'],
        'weight'        => ['show' => true, 'order' => 9, 'type' => 'number', 'groupAggregate' => 'max'],
        'locked_field'  => ['show' => true, 'order' => 10, 'type' => 'number', 'groupAggregate' => 'median'], // fungsi tak dikenal
        'double_amount' => ['show' => true, 'order' => 11, 'type' => 'number', 'groupAggregate' => 'sum', 'dependsOn' => ['amount']], // turunan
    ];

    protected function doubleAmount(): Attribute {
        return Attribute::make(get: fn () => (float) $this->amount * 2);
    }
}

/** Default group BERTINGKAT campuran string & objek (spec datatable2-group-tree, Requirement 2.2). */
class DtgMultiDefaultGroupRecord extends DtgRecord {
    protected static array|string|null $defaultGroups = [
        'category',
        ['column' => 'due_date', 'granularity' => 'year'],
        'name', // tidak groupable -> dibuang diam-diam, level lain tetap
    ];
}

class DataTableScopeGroupingTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (['users', 'preferences'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('dtg_customers')) {
            Schema::create('dtg_customers', function ($t) {
                $t->id();
                $t->string('name')->nullable();
                // FK milik relasi HasOne 'primaryContact' -- SENGAJA di tabel
                // ini (bukan dtg_records), krn itulah bedanya dgn BelongsTo.
                $t->unsignedBigInteger('primary_contact_of_record_id')->nullable();
            });
        }
        if (! Schema::hasTable('dtg_records')) {
            Schema::create('dtg_records', function ($t) {
                $t->id();
                $t->string('name')->nullable();
                $t->string('category')->nullable();
                $t->string('locked_field')->nullable();
                $t->unsignedBigInteger('customer_id')->nullable();
                $t->unsignedBigInteger('owner_id')->nullable();
                $t->string('owner_type')->nullable();
                $t->text('tags')->nullable();
                $t->date('due_date')->nullable();
                $t->decimal('amount', 10, 2)->nullable();
                // Kolom numerik tambahan utk agregat baris grup (groupAggregate).
                $t->integer('qty')->nullable();
                $t->decimal('price', 10, 2)->nullable();
                $t->decimal('weight', 10, 2)->nullable();
                $t->boolean('is_active')->nullable();
                $t->text('notes')->nullable();
                $t->text('statuses')->nullable();
                // `status` tunggal: TIDAK ada di $configColumns stub manapun --
                // groupable-nya harus datang dari defaultConfigColumns LinkModel.
                $t->string('status')->nullable();
                $t->boolean('is_example')->default(false);
                $t->timestamps();
            });
        }
    }

    // Non-ajax (default) -> Utils::isInertiaRequest() true -> lewat Inertia::share(),
    // groupCounts dibaca via Inertia::getShared().
    private function inertiaRequest(array $query = []): Request {
        return Request::create('/dtg-records', 'GET', $query);
    }

    // PENTING: assertEqualsCanonicalizing() MENGABAIKAN KEY array -- cuma
    // membandingkan KUMPULAN VALUE tanpa peduli key-nya sama sekali. Utk
    // groupCounts, KEY itu esensial (harus match String(groupKey) di FE) --
    // assertEqualsCanonicalizing keliru total dipakai di sini, false-positive
    // kalau 2 grup kebetulan count-nya sama tapi key ketuker (persis kasus
    // nyata: bug key boolean int 0/1 vs string "true"/"false" LOLOS test lama
    // krn assertEqualsCanonicalizing cuma cek {1,2,1} == {1,2,1} sbg SET,
    // ketauan hanya via browser + fwrite debug manual). ksort kedua sisi dulu
    // (urutan key hasil GROUP BY tak dijamin sama tiap run) lalu assertSame
    // (strict -- key DAN value harus persis sama).
    private function assertGroupCounts(array $expected, mixed $actual, string $message = ''): void {
        $this->assertIsArray($actual, $message);
        ksort($expected);
        ksort($actual);
        $this->assertSame($expected, $actual, $message);
    }

    // Request expand (`groupPath`): macro menyelesaikan node lalu MELEMPAR
    // HttpResponseException berisi JSON -- helper ini menangkapnya & mengembalikan
    // [status, payload]. Sengaja XHR (ajax) TANPA header X-Inertia, spt panggilan
    // axios GroupTree.
    private function expand(array $query, array $cookies = [], string $model = DtgRecord::class): array {
        try {
            $model::dataTable($this->ajax($query, $cookies));
        } catch (HttpResponseException $e) {
            return [$e->getResponse()->getStatusCode(), $e->getResponse()->getData(true)];
        }

        $this->fail('Request expand harus menghentikan request dgn HttpResponseException.');
    }

    // Level-0 pohon grup (spec datatable2-group-tree): `data` = paginator DESKRIPTOR
    // grup {key, raw, count, aggregates, label?}, bukan baris. Peta key => count ini
    // menggantikan prop `groupCounts` lama; KEY-nya tetap esensial (harus match
    // String(groupKey) di FE) -- baca dgn assertGroupCounts() (strict, ksort).
    private function levelZeroCounts(): array {
        return collect(Inertia::getShared('data')->items())->pluck('count', 'key')->all();
    }

    // Ajax TANPA header X-Inertia -> isInertiaRequest() false -> macro return
    // array langsung (dipakai test yang cuma butuh urutan/isi 'data', bukan
    // groupCounts -- pola sama dgn DataTableScopeDefaultSortTest).
    private function ajax(array $query = [], array $cookies = []): Request {
        return Request::create('/dtg-records', 'GET', $query, $cookies, server: [
            'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
        ]);
    }

    // Cookie kolom visible dgn nama sesuai sanitizer per-path (pola sama dgn
    // DataTableAdaptiveFetchTest::dtCookie()). Path test = /dtg-records →
    // key datatable_columns_dtg_records.
    private function dtCookie(array $cols): array {
        return ['datatable_columns_dtg_records' => json_encode($cols)];
    }

    // ---------------------------------------------------------------------
    // Gate sortable (Requirement 2, Property 5)
    // ---------------------------------------------------------------------

    public function test_sort_gate_rejects_sortable_false_column_falls_back_to_default(): void {
        $older = DtgRecord::create(['name' => 'A', 'locked_field' => 'z']);
        $older->forceFill(['created_at' => now()->subDay()])->save();
        $newer = DtgRecord::create(['name' => 'B', 'locked_field' => 'a']);
        $newer->forceFill(['created_at' => now()])->save();

        // ?sort=locked_field kalau DIPAKAI akan taruh 'a' (newer) duluan --
        // gate harus menolaknya dan fallback ke default (created_at desc).
        $result = DtgRecord::dataTable($this->ajax(['sort' => 'locked_field']));
        $items  = $result['data']->items();

        $this->assertSame($newer->id, $items[0]->id);
        $this->assertSame($older->id, $items[1]->id);
    }

    public function test_sort_gate_rejects_unknown_or_dotted_path_falls_back_to_default(): void {
        $older = DtgRecord::create(['name' => 'A']);
        $older->forceFill(['created_at' => now()->subDay()])->save();
        $newer = DtgRecord::create(['name' => 'B']);
        $newer->forceFill(['created_at' => now()])->save();

        foreach (['kolom_tidak_dikenal', 'customer.name'] as $badSort) {
            $result = DtgRecord::dataTable($this->ajax(['sort' => $badSort]));
            $items  = $result['data']->items();
            $this->assertSame($newer->id, $items[0]->id, "sort=$badSort harus fallback ke default, bukan error.");
            $this->assertSame($older->id, $items[1]->id);
        }
    }

    public function test_sort_gate_allows_normal_sortable_column_regression(): void {
        $a = DtgRecord::create(['name' => 'Alpha']);
        $b = DtgRecord::create(['name' => 'Beta']);

        $result = DtgRecord::dataTable($this->ajax(['sort' => 'name']));
        $items  = $result['data']->items();

        $this->assertSame($a->id, $items[0]->id);
        $this->assertSame($b->id, $items[1]->id);
    }

    // ---------------------------------------------------------------------
    // Grouping backend (Requirement 3, Property 1-4)
    // ---------------------------------------------------------------------

    public function test_group_counts_accurate_regardless_of_show_and_paginate_the_group_list(): void {
        foreach (range(1, 3) as $i) {
            DtgRecord::create(['name' => "Fruit $i", 'category' => 'fruit']);
        }
        foreach (range(1, 2) as $i) {
            DtgRecord::create(['name' => "Veg $i", 'category' => 'vegetable']);
        }

        // show=1 -> `show` membatasi jumlah GRUP per halaman level-0 (bukan baris),
        // tapi count tiap grup tetap total penuh (Property 1).
        DtgRecord::dataTable($this->inertiaRequest(['group' => 'category', 'show' => 1]));
        $page1 = Inertia::getShared('data');

        $this->assertSame(1, $page1->count());
        $this->assertSame(2, $page1->total(), 'Total = jumlah grup, bukan jumlah baris.');
        $this->assertSame(2, $page1->lastPage());
        $this->assertGroupCounts(['fruit' => 3], $this->levelZeroCounts());

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'category', 'show' => 1, 'page' => 2]));
        $this->assertGroupCounts(['vegetable' => 2], $this->levelZeroCounts());
    }

    public function test_group_counts_null_value_group_keyed_as_string_null(): void {
        // Regresi: pluck() polos bikin key null di-cast PHP jadi "" (array key
        // null -> ""), sedangkan FE stringify value null jadi literal "null"
        // (JS String(null)) -- mismatch bikin count grup null selalu 0 di UI.
        // Ditemukan saat visual test browser (bukan lolos test lama sebelum ini).
        foreach (range(1, 3) as $i) {
            DtgRecord::create(['name' => "No Category $i"]); // category null
        }
        DtgRecord::create(['name' => 'Fruit 1', 'category' => 'fruit']);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'category']));

        $groupCounts = $this->levelZeroCounts();
        $this->assertArrayHasKey(
            'null',
            $groupCounts,
            'Grup dgn value null harus di-key sbg string "null" (match JS String(null)), bukan "".',
        );
        $this->assertSame(3, $groupCounts['null']);
        $this->assertSame(1, $groupCounts['fruit']);
    }

    public function test_group_boolean_counts_keyed_as_true_false_strings_not_raw_db_value(): void {
        // Regresi nyata (ditemukan via browser LIVE, bukan unit test): count
        // query pakai stdClass mentah (query builder), $row->group_key TIDAK
        // lewat cast Eloquent 'boolean' -- SQLite/MySQL simpan is_active sbg
        // 0/1. Row DATA ASLI (model ter-hydrate) di-JSON-kan via cast jadi
        // true/false literal, FE baca via String(rawBoolean) => "true"/
        // "false". Tanpa normalisasi eksplisit, key "0"/"1" tak pernah match
        // "true"/"false" -- groupCounts lookup di UI selalu 0.
        DtgRecord::create(['name' => 'A', 'is_active' => true]);
        DtgRecord::create(['name' => 'B', 'is_active' => true]);
        DtgRecord::create(['name' => 'C', 'is_active' => false]);
        DtgRecord::create(['name' => 'D', 'is_active' => null]);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'is_active']));

        $this->assertGroupCounts(
            ['true' => 2, 'false' => 1, 'null' => 1],
            $this->levelZeroCounts(),
        );
    }

    public function test_group_not_groupable_column_returns_null_and_skips_query(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        DB::enableQueryLog();
        DtgRecord::dataTable($this->inertiaRequest(['group' => 'name']));
        $queries = collect(DB::getQueryLog())->pluck('query')->implode(' | ');
        DB::disableQueryLog();

        $this->assertNull(Inertia::getShared('groupMeta'), 'Kolom "name" tidak groupable -> null (Property 2).');
        $this->assertStringNotContainsStringIgnoringCase('group by', $queries);
    }

    public function test_group_relation_belongs_to_groups_by_foreign_key_column(): void {
        // BelongsTo: FK-nya ('customer_id') ada di tabel dtg_records SENDIRI --
        // bisa langsung GROUP BY, TIDAK seperti HasOne/MorphTo (lihat test lain).
        $c1 = DtgCustomerStub::create(['name' => 'Acme']);
        $c2 = DtgCustomerStub::create(['name' => 'Globex']);
        DtgRecord::create(['name' => 'A', 'customer_id' => $c1->id]);
        DtgRecord::create(['name' => 'B', 'customer_id' => $c1->id]);
        DtgRecord::create(['name' => 'C', 'customer_id' => $c2->id]);
        DtgRecord::create(['name' => 'D', 'customer_id' => null]);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'customer']));

        $this->assertGroupCounts(
            [(string) $c1->id => 2, (string) $c2->id => 1, 'null' => 1],
            $this->levelZeroCounts(),
            'GROUP BY pakai kolom FK riil (customer_id), di-key sbg string id (match row.customer.id di FE).',
        );
        // Label grup relasi = objek relasi UTUH (dari baris sampel MIN(pk) lewat
        // pipeline with() macro) -- FE butuh utk convertTemplateLink().
        $labels = collect(Inertia::getShared('data')->items())
            ->keyBy('key')
            ->map(fn ($group) => $group['label']['name'] ?? null)
            ->all();
        // Urutan `key ASC`: grup NULL tampil lebih dulu (SQLite & MySQL konsisten).
        $this->assertSame(['null' => null, (string) $c1->id => 'Acme', (string) $c2->id => 'Globex'], $labels);
    }

    // ---------------------------------------------------------------------
    // Regresi nyata (ditemukan lewat browser, BUKAN test lama): sort dulu
    // dikunci ke kolom grup (setGroup: sort = name) SECARA TIDAK SENGAJA jadi
    // satu-satunya mekanisme yg memaksa kolom grup masuk extraKeys (lewat
    // $sortKeyRaw). Setelah sort tidak lagi dikunci (compound sort, Task
    // 8.10), kolom grup yg TIDAK ditampilkan sbg kolom sendiri (mis.
    // account_type di halaman Accounts -- bukan kolom yg muncul di tabel)
    // hilang dari SELECT sama sekali kalau kebetulan tak ada di cookie
    // kolom visible -- row[groupBy] di FE jadi undefined, grouping GAGAL
    // TOTAL (bukan cuma label salah, datanya sendiri hilang). Test LAMA
    // (di atas) tidak nangkep ini krn tanpa cookie sama sekali,
    // safeColumnsFromVisible() fallback "semua show:true kolom visible" --
    // butuh cookie yg EKSPLISIT TIDAK menyertakan kolom grup utk mereproduksi.
    // ---------------------------------------------------------------------

    public function test_group_level_zero_does_not_depend_on_visible_columns_cookie_for_scalar_column(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'B', 'category' => 'fruit']);

        // Cookie HANYA menampilkan "name" -- "category" (kolom grup) sengaja
        // tidak disertakan. Nilai grup datang dari GROUP BY, bukan dari atribut
        // baris, jadi tak terpengaruh kolom visible (beda dgn mekanisme lama
        // yg butuh kolom grup ikut ter-SELECT).
        $cookie = $this->dtCookie(['name' => ['order' => 0]]);

        DtgRecord::dataTable(Request::create('/dtg-records', 'GET', ['group' => 'category'], $cookie));

        $this->assertGroupCounts(['fruit' => 2], $this->levelZeroCounts());
    }

    public function test_group_relation_label_loaded_even_when_excluded_from_visible_columns_cookie(): void {
        $c1 = DtgCustomerStub::create(['name' => 'Acme']);
        DtgRecord::create(['name' => 'A', 'customer_id' => $c1->id]);

        // Cookie HANYA "name" -- "customer" (kolom grup relasi) sengaja tidak
        // disertakan. Relasi tetap harus ter-eager-load utk baris sampel: tanpa
        // itu label grup di FE kosong.
        $cookie = $this->dtCookie(['name' => ['order' => 0]]);

        DtgRecord::dataTable(Request::create('/dtg-records', 'GET', ['group' => 'customer'], $cookie));

        $this->assertSame('Acme', Inertia::getShared('data')->items()[0]['label']['name'] ?? null);
    }

    public function test_group_relation_has_one_rejected_fk_not_on_this_table(): void {
        // HasOne: FK-nya ('primary_contact_of_record_id') ada di tabel LAIN
        // (dtg_customers), bukan dtg_records -- tidak bisa langsung GROUP BY
        // tanpa JOIN, sengaja tidak didukung meski type-nya sama-sama 'relation'
        // dgn BelongsTo (bedanya cuma ketauan dari instanceof relasi riil).
        DtgRecord::create(['name' => 'A']);

        // Nama kolom di dataTableColumns SUDAH snake_case (LinkModel::Str::snake
        // dari nama method) -- 'primaryContact' -> 'primary_contact'.
        DtgRecord::dataTable($this->inertiaRequest(['group' => 'primary_contact']));

        $this->assertNull(
            Inertia::getShared('groupMeta'),
            'Relasi HasOne ditolak walau type-nya "relation" & groupable:true di config.',
        );
    }

    public function test_group_blank_render_type_rejected_even_if_misconfigured_groupable(): void {
        // 'tags' type-nya di-override 'json' via config -- Cell.jsx (FE) render
        // blank utk type ini, jadi tidak boleh jadi opsi Group by sama sekali.
        DtgRecord::create(['name' => 'A', 'tags' => '["x"]']);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'tags']));

        $this->assertNull(
            Inertia::getShared('groupMeta'),
            'Type "json" (render blank di Cell.jsx) ditolak walau groupable:true di config.',
        );
    }

    public function test_group_html_type_rejected_even_if_misconfigured_groupable(): void {
        // 'notes' type-nya 'html' -- SECARA TEKNIS bisa dirender Cell.jsx
        // (dangerouslySetInnerHTML), tapi grouping by markup mentah nyaris tak
        // pernah berguna, DAN contoh nyata satu2nya kolom html di codebase
        // (Log.activity_text) adalah PHP accessor terhitung -- GROUP BY ke situ
        // akan error SQL. Ditolak total, walau groupable:true di config.
        DtgRecord::create(['name' => 'A', 'notes' => '<b>Penting</b>']);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'notes']));

        $this->assertNull(
            Inertia::getShared('groupMeta'),
            'Type "html" ditolak walau groupable:true di config.',
        );
    }

    public function test_group_single_form_status_groupable_by_default_on_non_submitable_model(): void {
        // Model non-Submitable (spt Ticket/User) dgn `status` scalar ber-cast
        // FormStatusCast: TANPA groupable di configColumns, cukup dari
        // defaultConfigColumns LinkModel. Key = nilai mentah kolom ('draft'),
        // sama dgn String(row.status) di FE (enum di-JSON-kan ke ->value).
        DtgSingleStatusRecord::create(['name' => 'A', 'status' => FormStatus::DRAFT]);
        DtgSingleStatusRecord::create(['name' => 'B', 'status' => FormStatus::DRAFT]);
        DtgSingleStatusRecord::create(['name' => 'C', 'status' => FormStatus::APPROVED]);
        DtgSingleStatusRecord::create(['name' => 'D']);

        DtgSingleStatusRecord::dataTable($this->inertiaRequest(['group' => 'status']));

        $this->assertGroupCounts(
            ['draft' => 2, 'approved' => 1, 'null' => 1],
            $this->levelZeroCounts(),
        );
    }

    public function test_group_plain_string_status_groupable_by_default(): void {
        // `status` string biasa tanpa cast (spt Lead/Todo/PaymentSchedule).
        DtgRecord::create(['name' => 'A', 'status' => 'new']);
        DtgRecord::create(['name' => 'B', 'status' => 'new']);
        DtgRecord::create(['name' => 'C', 'status' => 'won']);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'status']));

        $this->assertGroupCounts(
            ['new' => 2, 'won' => 1],
            $this->levelZeroCounts(),
        );
    }

    public function test_group_derived_accessor_column_rejected_even_if_misconfigured_groupable(): void {
        // Kolom turunan (dependsOn) bukan kolom SQL -- ditolak total, bukan
        // dibiarkan lolos lalu 500 "no such column" saat ORDER BY/GROUP BY.
        DtgDerivedRecord::create(['name' => 'a']);
        DtgDerivedRecord::create(['name' => 'b']);

        DtgDerivedRecord::dataTable($this->inertiaRequest(['group' => 'name_upper']));

        $this->assertNull(
            Inertia::getShared('groupMeta'),
            'Kolom turunan (dependsOn) tak boleh jadi kolom grup walau groupable:true.',
        );
        $this->assertFalse(
            collect(Inertia::getShared('dataTableColumns'))->firstWhere('name', 'name_upper')['groupable'] ?? null,
            'Flag groupable kolom turunan harus dipaksa false supaya tak muncul di dropdown Group by.',
        );
    }

    public function test_group_physical_column_with_depends_on_is_still_groupable(): void {
        // Regresi: sempat mau mendeteksi "turunan" lewat dependsOn -- salah,
        // PurchaseRequest::status (kolom JSON fisik) punya dependsOn juga.
        DtgPhysicalWithDependsOnRecord::create(['name' => 'A', 'category' => 'x']);
        DtgPhysicalWithDependsOnRecord::create(['name' => 'B', 'category' => 'x']);
        DtgPhysicalWithDependsOnRecord::create(['name' => 'C', 'category' => 'y']);

        DtgPhysicalWithDependsOnRecord::dataTable($this->inertiaRequest(['group' => 'category']));

        $this->assertGroupCounts(['x' => 2, 'y' => 1], $this->levelZeroCounts());
    }

    public function test_group_morph_to_relation_rejected_even_if_misconfigured_groupable(): void {
        // Grup by `owner_id` saja mencampur baris lintas-tipe (id 1 bertipe
        // customer vs id 1 bertipe record jadi 1 grup) -- ditolak total.
        DtgMorphRecord::create(['name' => 'A', 'owner_id' => 1, 'owner_type' => DtgCustomerStub::class]);
        DtgMorphRecord::create(['name' => 'B', 'owner_id' => 1, 'owner_type' => DtgRecord::class]);

        DtgMorphRecord::dataTable($this->inertiaRequest(['group' => 'owner']));

        $this->assertNull(
            Inertia::getShared('groupMeta'),
            'MorphTo tak boleh jadi kolom grup walau groupable:true di config.',
        );
        $this->assertFalse(
            collect(Inertia::getShared('dataTableColumns'))->firstWhere('name', 'owner')['groupable'] ?? null,
            'Flag groupable MorphTo harus dipaksa false supaya tak muncul di dropdown Group by.',
        );
    }

    public function test_group_form_statuses_array_grouped_by_exact_json_value(): void {
        // formStatuses (jamak, mis. Submitable::status): value-nya ARRAY status
        // (disimpan sbg JSON text di DB, mis. '["draft"]'). GROUP BY di sini
        // pakai STRING JSON MENTAH -- array dgn isi & URUTAN identik grup
        // bareng, beda urutan/isi grup terpisah (grouping-by-array-mentah,
        // bukan set-equality -- keputusan sadar, bukan bug, lihat komentar FE
        // Table2.jsx groupKeyOf). Row data asli (data.data) di-JSON-kan
        // Eloquent via Inertia -- PHP FormStatus (backed enum) implement
        // JsonSerializable, serialize ke ->value -- hasilnya PERSIS SAMA dgn
        // JSON mentah yg tersimpan, jadi FE bisa pakai JSON.stringify(row[groupBy])
        // sbg key yg cocok tanpa perlu normalisasi backend (beda dari boolean).
        DtgRecord::create(['name' => 'A', 'statuses' => FormStatus::DRAFT]);
        DtgRecord::create(['name' => 'B', 'statuses' => FormStatus::DRAFT]);
        DtgRecord::create(['name' => 'C', 'statuses' => [FormStatus::APPROVED, FormStatus::PENDING]]);
        // Cast set() tak terima null langsung (lempar exception) -- kolom
        // nullable dites via OMIT attribute-nya sama sekali (default DB null).
        DtgRecord::create(['name' => 'D']);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'statuses']));

        $this->assertGroupCounts(
            ['["draft"]' => 2, '["approved","pending"]' => 1, 'null' => 1],
            $this->levelZeroCounts(),
        );
    }

    public function test_group_form_statuses_key_normalized_when_db_returns_spaced_json(): void {
        // MySQL menormalkan output kolom JSON jadi `["a", "b"]` (spasi setelah
        // koma), sedangkan FE (JSON.stringify) & row hasil cast bikin
        // `["a","b"]`. Tanpa normalisasi key groupCounts tak pernah match
        // lookup FE utk status multi-elemen -> count grup selalu 0. Insert
        // mentah dgn spasi meniru keluaran MySQL di SQLite. Dua bentuk teks
        // beda (MariaDB simpan JSON sbg teks verbatim -> jadi 2 baris GROUP
        // BY) harus DIJUMLAHKAN ke 1 key, bukan saling timpa.
        DB::table('dtg_records')->insert([
            ['name' => 'A', 'statuses' => '["approved", "pending"]'],
            ['name' => 'B', 'statuses' => '["approved","pending"]'],
            ['name' => 'C', 'statuses' => '["draft"]'],
        ]);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'statuses']));

        $this->assertGroupCounts(
            ['["approved","pending"]' => 2, '["draft"]' => 1],
            $this->levelZeroCounts(),
        );
    }

    public function test_group_relation_sanitizes_dropdown_flag_shared_to_frontend(): void {
        // groupable yg dipaksa false (HasOne/json) harus KELIHATAN false di
        // dataTableColumns yg dikirim ke FE juga -- bukan cuma di-reject saat
        // query, supaya dropdown "Group by" TIDAK menampilkannya sbg opsi.
        DtgRecord::create(['name' => 'A']);

        DtgRecord::dataTable($this->inertiaRequest());
        $columns = collect(Inertia::getShared('dataTableColumns'));

        $this->assertFalse($columns->firstWhere('name', 'primary_contact')['groupable'] ?? null);
        $this->assertFalse($columns->firstWhere('name', 'tags')['groupable'] ?? null);
        $this->assertFalse($columns->firstWhere('name', 'notes')['groupable'] ?? null);
        $this->assertTrue($columns->firstWhere('name', 'customer')['groupable'] ?? null);
    }

    // ---------------------------------------------------------------------
    // Compound sort: grup SELALU jadi ORDER BY primer, pilihan sort user
    // jadi sekunder (tie-breaker) -- TIDAK lagi "dikunci" (Requirement baru,
    // ganti mekanisme lama single-column-locked).
    // ---------------------------------------------------------------------

    public function test_group_list_is_ordered_by_key_asc_regardless_of_user_sort(): void {
        // Urutan daftar grup SELALU `key ASC` (relasi: menurut nilai FK) --
        // independen dari `?sort=` (sort user hanya utk baris di node daun).
        $c1 = DtgCustomerStub::create(['name' => 'Acme']);
        $c2 = DtgCustomerStub::create(['name' => 'Globex']);
        DtgRecord::create(['name' => 'A', 'customer_id' => $c2->id]);
        DtgRecord::create(['name' => 'B', 'customer_id' => $c1->id]);
        DtgRecord::create(['name' => 'C', 'customer_id' => $c2->id]);
        DtgRecord::create(['name' => 'D', 'customer_id' => $c1->id]);

        foreach ([[], ['sort' => '-name'], ['sort' => 'name']] as $extra) {
            DtgRecord::dataTable($this->inertiaRequest(['group' => 'customer', ...$extra]));

            $this->assertSame(
                [(string) $c1->id, (string) $c2->id],
                array_column(Inertia::getShared('data')->items(), 'key'),
            );
        }
    }

    public function test_leaf_node_rows_follow_user_sort(): void {
        // Sort pilihan user ("name" asc) = SATU-SATUNYA ORDER BY baris di node
        // daun (tak ada lagi sort primer by kolom grup -- semua baris di node itu
        // sudah satu grup penuh).
        DtgRecord::create(['name' => 'Zeta', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Alpha', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Yankee', 'category' => 'vegetable']);
        DtgRecord::create(['name' => 'Bravo', 'category' => 'vegetable']);

        [$status, $payload] = $this->expand([
            'group'     => 'category',
            'groupPath' => json_encode(['fruit']),
            'sort'      => 'name',
        ]);

        $this->assertSame(200, $status);
        $this->assertSame('rows', $payload['type']);
        $this->assertSame(['Alpha', 'Zeta'], array_column($payload['data'], 'name'));
    }

    // ---------------------------------------------------------------------
    // Bucket: granularity date/time/datetime & range number/currency
    // ---------------------------------------------------------------------

    public function test_group_date_default_granularity_is_month(): void {
        DtgRecord::create(['name' => 'A', 'due_date' => '2026-01-15']);
        DtgRecord::create(['name' => 'B', 'due_date' => '2026-01-28']);
        DtgRecord::create(['name' => 'C', 'due_date' => '2026-02-01']);

        // Tanpa ?groupGranularity= sama sekali -- default 'month'.
        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date']));

        $this->assertGroupCounts(
            ['2026-01' => 2, '2026-02' => 1],
            $this->levelZeroCounts(),
        );
    }

    public function test_group_date_granularity_day_quarter_half_year(): void {
        DtgRecord::create(['name' => 'A', 'due_date' => '2026-01-15']); // Q1, H1
        DtgRecord::create(['name' => 'B', 'due_date' => '2026-04-20']); // Q2, H1
        DtgRecord::create(['name' => 'C', 'due_date' => '2026-07-05']); // Q3, H2
        DtgRecord::create(['name' => 'D', 'due_date' => '2026-12-31']); // Q4, H2

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date', 'groupGranularity' => 'day']));
        $this->assertGroupCounts(
            ['2026-01-15' => 1, '2026-04-20' => 1, '2026-07-05' => 1, '2026-12-31' => 1],
            $this->levelZeroCounts(),
        );

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date', 'groupGranularity' => 'quarter']));
        $this->assertGroupCounts(
            ['2026-Q1' => 1, '2026-Q2' => 1, '2026-Q3' => 1, '2026-Q4' => 1],
            $this->levelZeroCounts(),
        );

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date', 'groupGranularity' => 'half']));
        $this->assertGroupCounts(
            ['2026-H1' => 2, '2026-H2' => 2],
            $this->levelZeroCounts(),
        );

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date', 'groupGranularity' => 'year']));
        $this->assertGroupCounts(
            ['2026' => 4],
            $this->levelZeroCounts(),
        );
    }

    public function test_group_date_invalid_granularity_falls_back_to_month(): void {
        DtgRecord::create(['name' => 'A', 'due_date' => '2026-01-15']);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date', 'groupGranularity' => 'decade']));

        $this->assertGroupCounts(['2026-01' => 1], $this->levelZeroCounts());
    }

    public function test_group_date_bucket_list_is_ordered_chronologically_by_bucket_key(): void {
        // Baris SEBENARNYA punya due_date berbeda dalam bulan yg sama -- daftar
        // grup dibentuk dari ekspresi bucket & diurut by key bucket (string yg
        // urut leksikografis = urut kronologis).
        DtgRecord::create(['name' => 'A', 'due_date' => '2026-02-01']);
        DtgRecord::create(['name' => 'B', 'due_date' => '2026-01-28']);
        DtgRecord::create(['name' => 'C', 'due_date' => '2026-01-01']);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date']));

        $items = Inertia::getShared('data')->items();
        $this->assertSame(['2026-01', '2026-02'], array_column($items, 'key'));
        $this->assertSame([2, 1], array_column($items, 'count'));
    }

    public function test_group_number_default_range_uses_first_configured_option(): void {
        // Stub 'amount' groupRangeOptions: [10, 100] -- tanpa ?groupRange=,
        // default pakai opsi PERTAMA (10).
        DtgRecord::create(['name' => 'A', 'amount' => 5]);
        DtgRecord::create(['name' => 'B', 'amount' => 12]);
        DtgRecord::create(['name' => 'C', 'amount' => 19]);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'amount']));

        // floor(5/10)*10=0, floor(12/10)*10=10, floor(19/10)*10=10.
        $this->assertGroupCounts(['0' => 1, '10' => 2], $this->levelZeroCounts());
    }

    public function test_group_number_explicit_range(): void {
        DtgRecord::create(['name' => 'A', 'amount' => 150]);
        DtgRecord::create(['name' => 'B', 'amount' => 180]);
        DtgRecord::create(['name' => 'C', 'amount' => 250]);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'amount', 'groupRange' => 100]));

        // floor(150/100)*100=100, floor(180/100)*100=100, floor(250/100)*100=200.
        $this->assertGroupCounts(['100' => 2, '200' => 1], $this->levelZeroCounts());
    }

    public function test_group_number_invalid_range_falls_back_to_default(): void {
        DtgRecord::create(['name' => 'A', 'amount' => 5]);

        foreach (['-50', '0', 'abc'] as $badRange) {
            DtgRecord::dataTable($this->inertiaRequest(['group' => 'amount', 'groupRange' => $badRange]));
            // Fallback ke opsi pertama (10): floor(5/10)*10=0.
            $this->assertGroupCounts(
                ['0' => 1],
                $this->levelZeroCounts(),
                "groupRange=$badRange harus fallback ke default, bukan dipakai mentah.",
            );
        }
    }

    /**
     * Query count grup bucket (date/number) harus GROUP BY alias `group_key`,
     * BUKAN mengulang ekspresi bucket. Di MySQL (prepared statement native,
     * ONLY_FULL_GROUP_BY) ekspresi `floor(x / ?) * ?` di SELECT dan di GROUP BY
     * dianggap BEDA krn tiap placeholder berdiri sendiri -> error 1055. Test
     * ini jalan di SQLite yg tak mengalami itu, jadi yang dipin adalah BENTUK
     * SQL-nya.
     */
    public function test_group_bucket_count_query_groups_by_alias_not_repeated_expression(): void {
        DtgRecord::create(['name' => 'A', 'amount' => 5, 'due_date' => '2026-01-15']);

        foreach ([['group' => 'amount', 'groupRange' => 10], ['group' => 'due_date', 'groupGranularity' => 'month']] as $params) {
            DB::flushQueryLog();
            DB::enableQueryLog();
            DtgRecord::dataTable($this->inertiaRequest($params));
            $countSql = collect(DB::getQueryLog())->pluck('query')->first(fn ($q) => str_contains($q, 'aggregate_count'));

            $this->assertNotNull($countSql, 'Query count grup tidak ditemukan untuk ' . json_encode($params));
            $this->assertMatchesRegularExpression('/group by [`"]group_key[`"]/i', $countSql, json_encode($params));
        }
    }

    // ---------------------------------------------------------------------
    // Default group per-model (mirip $defaultSortColumn)
    // ---------------------------------------------------------------------

    public function test_default_group_applies_when_request_has_no_group_param(): void {
        // Dibuat selang-seling: tanpa sort primer by grup, urutan default
        // (created_at desc) akan menyelang-nyelingkan kategori.
        DtgDefaultGroupRecord::create(['name' => 'A', 'category' => 'vegetable']);
        DtgDefaultGroupRecord::create(['name' => 'B', 'category' => 'fruit']);
        DtgDefaultGroupRecord::create(['name' => 'C', 'category' => 'vegetable']);
        DtgDefaultGroupRecord::create(['name' => 'D', 'category' => 'fruit']);

        DtgDefaultGroupRecord::dataTable($this->inertiaRequest());

        $this->assertGroupCounts(['fruit' => 2, 'vegetable' => 2], $this->levelZeroCounts());
        $this->assertSame(['category'], array_column(Inertia::getShared('defaultGroups'), 'column'));
        $this->assertSame(
            ['fruit', 'vegetable'],
            array_column(Inertia::getShared('data')->items(), 'key'),
            'Level-0 berisi daftar grup (bukan baris) berurut key ASC.',
        );
    }

    public function test_default_group_not_applied_to_plain_ajax_request(): void {
        // Endpoint non-halaman (dropdown LinkModel dst, XHR tanpa header
        // X-Inertia) tak boleh berubah urutan / kena query count grup krn
        // default group model.
        DtgDefaultGroupRecord::create(['name' => 'A', 'category' => 'vegetable']);
        DtgDefaultGroupRecord::create(['name' => 'B', 'category' => 'fruit']);
        DtgDefaultGroupRecord::create(['name' => 'C', 'category' => 'vegetable']);
        DtgDefaultGroupRecord::create(['name' => 'D', 'category' => 'fruit']);

        $result     = DtgDefaultGroupRecord::dataTable($this->ajax());
        $categories = collect($result['data']->items())->pluck('category')->all();

        // created_at keempat record bisa sama (detik yg sama) sehingga urutan
        // tie tak deterministik -- yg dibuktikan: TIDAK ter-grup primer.
        $this->assertCount(4, $categories);
        $this->assertNotSame(
            ['fruit', 'fruit', 'vegetable', 'vegetable'],
            $categories,
            'Request XHR biasa tidak boleh kena sort primer by default group.',
        );
    }

    public function test_default_group_can_be_disabled_with_explicit_empty_group_param(): void {
        DtgDefaultGroupRecord::create(['name' => 'A', 'category' => 'fruit']);

        // `?group=` (ada tapi kosong) = user sengaja memilih "Tidak ada".
        DtgDefaultGroupRecord::dataTable($this->inertiaRequest(['group' => '']));

        $this->assertNull(Inertia::getShared('groupMeta'));
        // Default tetap dibagikan supaya FE tahu harus kirim `group=` kosong
        // (bukan menghilangkan param) saat user memilih "Tidak ada".
        $this->assertSame(['category'], array_column(Inertia::getShared('defaultGroups'), 'column'));
    }

    public function test_explicit_group_param_overrides_default_group(): void {
        DtgDefaultGroupRecord::create(['name' => 'A', 'category' => 'fruit', 'is_active' => true]);
        DtgDefaultGroupRecord::create(['name' => 'B', 'category' => 'fruit', 'is_active' => false]);

        DtgDefaultGroupRecord::dataTable($this->inertiaRequest(['group' => 'is_active']));

        $this->assertGroupCounts(['true' => 1, 'false' => 1], $this->levelZeroCounts());
    }

    public function test_default_group_on_non_groupable_column_is_ignored(): void {
        DtgBadDefaultGroupRecord::create(['name' => 'A']);

        DtgBadDefaultGroupRecord::dataTable($this->inertiaRequest());

        $this->assertNull(Inertia::getShared('groupMeta'));
        $this->assertSame([], Inertia::getShared('defaultGroups'));
    }

    public function test_model_without_default_group_is_not_grouped_and_shares_null_default(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        DtgRecord::dataTable($this->inertiaRequest());

        $this->assertNull(Inertia::getShared('groupMeta'));
        $this->assertSame([], Inertia::getShared('defaultGroups'));
    }

    public function test_group_counts_respect_active_filter(): void {
        $user = User::factory()->create();

        DtgRecord::create(['name' => 'Fruit 1', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Fruit 2', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Veg 1', 'category' => 'vegetable']);
        DtgRecord::create(['name' => 'Veg 2', 'category' => 'vegetable']);

        $tree = ['root' => ['k' => 'and', 'c' => [
            'i1' => ['k' => 'name', 'o' => '!=', 'v' => 'Fruit 1'],
        ]]];
        $saved = SavedFilter::create([
            'user_id'  => $user->id,
            'model'    => DtgRecord::class,
            'filter'   => $tree,
            'is_saved' => true,
        ]);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'category', 'fid' => $saved->id]));

        $this->assertGroupCounts(
            ['fruit' => 1, 'vegetable' => 2],
            $this->levelZeroCounts(),
            'groupCounts dihitung dari row-set yang SAMA dengan data.data -- ikut filter aktif (Property 3).',
        );
        $this->assertSame(3, array_sum($this->levelZeroCounts()), 'Total baris = jumlah count semua grup.');
        $this->assertSame(2, Inertia::getShared('data')->total());
    }

    public function test_no_group_param_runs_zero_group_by_queries(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        DB::enableQueryLog();
        DtgRecord::dataTable($this->inertiaRequest());
        $queries = collect(DB::getQueryLog())->pluck('query')->implode(' | ');
        DB::disableQueryLog();

        $this->assertStringNotContainsStringIgnoringCase(
            'group by',
            $queries,
            'Tanpa ?group=, tidak ada query GROUP BY tambahan sama sekali (Property 4, zero overhead).',
        );
        $this->assertNull(Inertia::getShared('groupMeta'));
    }

    // ---------------------------------------------------------------------
    // Group dari filter aktif (Requirement 12): prioritas param > filter
    // aktif (?fid= / default shared filter) > default model.
    // ---------------------------------------------------------------------

    public function test_group_from_saved_filter_applied_via_fid(): void {
        $user = User::factory()->create();
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'B', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'C', 'category' => 'vegetable']);

        $saved = SavedFilter::create([
            'user_id'  => $user->id,
            'model'    => DtgRecord::class,
            'filter'   => ['root' => ['k' => 'and', 'c' => []]],
            'is_saved' => true,
            'group'    => ['column' => 'category', 'granularity' => null, 'range' => null],
        ]);

        DtgRecord::dataTable($this->inertiaRequest(['fid' => $saved->id]));

        $this->assertGroupCounts(['fruit' => 2, 'vegetable' => 1], $this->levelZeroCounts());
        $this->assertSame(['category'], array_column(Inertia::getShared('defaultGroups'), 'column'));
    }

    /**
     * Group milik filter aktif HANYA utk request halaman/Inertia (sama spt
     * default grup model) -- konsumen XHR macro (mis. QuickListBlock dgn
     * ?fid=) tak merender header grup, jadi urutan barisnya tak boleh
     * dipaksa by kolom grup & tak ada query GROUP BY tambahan.
     */
    public function test_group_from_saved_filter_not_applied_on_xhr_request(): void {
        $user = User::factory()->create();
        DtgRecord::create(['name' => 'A', 'category' => 'vegetable']);
        DtgRecord::create(['name' => 'B', 'category' => 'fruit']);

        $saved = SavedFilter::create([
            'user_id'  => $user->id,
            'model'    => DtgRecord::class,
            'filter'   => ['root' => ['k' => 'and', 'c' => []]],
            'is_saved' => true,
            'group'    => ['column' => 'category', 'granularity' => null, 'range' => null],
        ]);

        DB::enableQueryLog();
        DtgRecord::dataTable($this->ajax(['fid' => $saved->id]));
        $queries = collect(DB::getQueryLog())->pluck('query')->implode(' | ');
        DB::disableQueryLog();

        $this->assertStringNotContainsStringIgnoringCase('group by', $queries);
        $this->assertStringNotContainsStringIgnoringCase('order by "dtg_records"."category"', $queries);
    }

    public function test_group_from_default_shared_filter_applied_without_fid(): void {
        $user = User::factory()->create();
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'B', 'category' => 'vegetable']);

        SavedFilter::create([
            'user_id'    => $user->id,
            'model'      => DtgRecord::class,
            'filter'     => ['root' => ['k' => 'and', 'c' => []]],
            'name'       => 'Default',
            'is_saved'   => true,
            'is_shared'  => true,
            'is_default' => true,
            'group'      => ['column' => 'category', 'granularity' => null, 'range' => null],
        ]);

        DtgRecord::dataTable($this->inertiaRequest());

        $this->assertGroupCounts(['fruit' => 1, 'vegetable' => 1], $this->levelZeroCounts());
        $this->assertSame(['category'], array_column(Inertia::getShared('defaultGroups'), 'column'));
    }

    public function test_explicit_empty_group_param_overrides_filter_group(): void {
        $user = User::factory()->create();
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        $saved = SavedFilter::create([
            'user_id' => $user->id, 'model' => DtgRecord::class,
            'filter'  => ['root' => ['k' => 'and', 'c' => []]], 'is_saved' => true,
            'group'   => ['column' => 'category'],
        ]);

        DtgRecord::dataTable($this->inertiaRequest(['fid' => $saved->id, 'group' => '']));

        $this->assertNull(Inertia::getShared('groupMeta'), '?group= kosong eksplisit menang atas group filter aktif.');
        // defaultGroup* tetap mencerminkan group EFEKTIF TANPA PARAM (filter
        // aktif), agar FE tahu apa yg akan diterapkan lagi kalau user hapus
        // override "Tidak ada"-nya (Requirement 12.6).
        $this->assertSame(['category'], array_column(Inertia::getShared('defaultGroups'), 'column'));
    }

    public function test_group_from_filter_not_groupable_is_ignored(): void {
        $user = User::factory()->create();
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        $saved = SavedFilter::create([
            'user_id' => $user->id, 'model' => DtgRecord::class,
            'filter'  => ['root' => ['k' => 'and', 'c' => []]], 'is_saved' => true,
            'group'   => ['column' => 'name'], // 'name' bukan kolom groupable
        ]);

        DtgRecord::dataTable($this->inertiaRequest(['fid' => $saved->id]));

        $this->assertNull(
            Inertia::getShared('groupMeta'),
            'Kolom grup dari filter aktif tak lolos gate groupable -> diabaikan diam-diam (Requirement 12.4).',
        );
        $this->assertSame([], Inertia::getShared('defaultGroups'));
    }

    public function test_group_granularity_fallback_from_filter(): void {
        $user = User::factory()->create();
        DtgRecord::create(['name' => 'A', 'due_date' => '2026-01-15']);
        DtgRecord::create(['name' => 'B', 'due_date' => '2026-04-20']);

        $saved = SavedFilter::create([
            'user_id' => $user->id, 'model' => DtgRecord::class,
            'filter'  => ['root' => ['k' => 'and', 'c' => []]], 'is_saved' => true,
            'group'   => ['column' => 'due_date', 'granularity' => 'quarter'],
        ]);

        DtgRecord::dataTable($this->inertiaRequest(['fid' => $saved->id]));

        $this->assertGroupCounts(['2026-Q1' => 1, '2026-Q2' => 1], $this->levelZeroCounts());
        $this->assertSame(['due_date'], array_column(Inertia::getShared('defaultGroups'), 'column'));
        $this->assertSame('quarter', Inertia::getShared('defaultGroups')[0]['granularity']);
    }

    public function test_group_range_fallback_from_filter(): void {
        $user = User::factory()->create();
        DtgRecord::create(['name' => 'A', 'amount' => 150]);
        DtgRecord::create(['name' => 'B', 'amount' => 250]);

        $saved = SavedFilter::create([
            'user_id' => $user->id, 'model' => DtgRecord::class,
            'filter'  => ['root' => ['k' => 'and', 'c' => []]], 'is_saved' => true,
            'group'   => ['column' => 'amount', 'range' => 100],
        ]);

        DtgRecord::dataTable($this->inertiaRequest(['fid' => $saved->id]));

        // floor(150/100)*100=100, floor(250/100)*100=200.
        $this->assertGroupCounts(['100' => 1, '200' => 1], $this->levelZeroCounts());
        $this->assertSame(100, Inertia::getShared('defaultGroups')[0]['range']);
    }

    public function test_explicit_granularity_param_overrides_filter_granularity(): void {
        $user = User::factory()->create();
        DtgRecord::create(['name' => 'A', 'due_date' => '2026-01-15']);
        DtgRecord::create(['name' => 'B', 'due_date' => '2026-07-05']);

        $saved = SavedFilter::create([
            'user_id' => $user->id, 'model' => DtgRecord::class,
            'filter'  => ['root' => ['k' => 'and', 'c' => []]], 'is_saved' => true,
            'group'   => ['column' => 'due_date', 'granularity' => 'quarter'],
        ]);

        // ?groupGranularity= eksplisit menang atas granularity filter aktif
        // (Requirement 12.3).
        DtgRecord::dataTable($this->inertiaRequest(['fid' => $saved->id, 'groupGranularity' => 'half']));

        $this->assertGroupCounts(['2026-H1' => 1, '2026-H2' => 1], $this->levelZeroCounts());
    }

    // ---------------------------------------------------------------------
    // GroupLevelResolver multi-level (spec datatable2-group-tree, Requirement 4)
    // ---------------------------------------------------------------------

    /**
     * Panggil resolver langsung dgn stub model -- macro belum mengekspos
     * multi-level lewat prop share sebelum node query (task 3.4+).
     *
     * @param  array<mixed>  $applied  Groups milik filter aktif
     * @param  array<mixed>  $defaults  Groups default model
     * @return list<ResolvedGroupLevel>
     */
    private function resolveLevels(array $query = [], array $applied = [], array $defaults = []): array {
        $record  = new DtgRecord;
        $columns = GroupColumnGate::sanitizeColumns(DtgRecord::getColumns(1), $record);

        return GroupLevelResolver::resolve(
            $this->inertiaRequest($query),
            $applied,
            $defaults,
            $columns,
            $record,
            $record->getTable(),
        );
    }

    /**
     * @param  list<ResolvedGroupLevel>  $levels
     * @return list<string>
     */
    private function columnsOf(array $levels): array {
        return array_map(fn (ResolvedGroupLevel $l) => $l->column, $levels);
    }

    public function test_resolver_reads_multi_level_group_in_url_order(): void {
        $levels = $this->resolveLevels(['group' => 'category,due_date,amount']);

        $this->assertSame(['category', 'due_date', 'amount'], $this->columnsOf($levels));
        // Nilai EFEKTIF: date default 'month', number default = opsi pertama config (10).
        $this->assertNull($levels[0]->granularity);
        $this->assertSame('month', $levels[1]->granularity);
        $this->assertSame(10, $levels[2]->range);
        $this->assertNull($levels[0]->bucket);
        $this->assertNotNull($levels[1]->bucket, 'Level date butuh ekspresi bucket.');
        $this->assertNotNull($levels[2]->bucket, 'Level number butuh ekspresi bucket.');
    }

    public function test_resolver_url_group_overrides_filter_and_model_default(): void {
        $levels = $this->resolveLevels(
            ['group' => 'is_active'],
            applied: [['column' => 'category']],
            defaults: [['column' => 'due_date']],
        );

        $this->assertSame(['is_active'], $this->columnsOf($levels));
    }

    public function test_resolver_empty_group_param_means_none_even_with_filter_and_default(): void {
        $levels = $this->resolveLevels(
            ['group' => ''],
            applied: [['column' => 'category']],
            defaults: [['column' => 'due_date']],
        );

        $this->assertSame([], $levels);
    }

    public function test_resolver_without_group_param_prefers_filter_group_over_model_default(): void {
        $withFilter  = $this->resolveLevels([], applied: [['column' => 'category']], defaults: [['column' => 'due_date']]);
        $onlyDefault = $this->resolveLevels([], applied: [], defaults: [['column' => 'due_date'], ['column' => 'category']]);

        $this->assertSame(['category'], $this->columnsOf($withFilter));
        $this->assertSame(['due_date', 'category'], $this->columnsOf($onlyDefault));
    }

    public function test_resolver_drops_non_groupable_levels_but_keeps_the_rest_in_order(): void {
        // 'name' tidak groupable, 'tags' (json) & 'notes' (html) ditolak sanitizer,
        // 'primary_contact' HasOne ditolak -- sisanya tetap berurutan.
        $levels = $this->resolveLevels(['group' => 'name,category,tags,due_date,notes,primary_contact,unknown_col']);

        $this->assertSame(['category', 'due_date'], $this->columnsOf($levels));
    }

    public function test_resolver_truncates_to_four_levels_after_gating(): void {
        // 1 tak-groupable + 5 groupable: gate dulu (buang 'name'), baru potong ke 4.
        $levels = $this->resolveLevels(['group' => 'name,category,customer,due_date,amount,is_active']);

        $this->assertSame(['category', 'customer', 'due_date', 'amount'], $this->columnsOf($levels));
    }

    public function test_resolver_dedupes_repeated_column_keeping_the_first(): void {
        $levels = $this->resolveLevels(['group' => 'category,due_date,category']);

        $this->assertSame(['category', 'due_date'], $this->columnsOf($levels));
    }

    public function test_resolver_reads_granularity_and_range_per_column(): void {
        $levels = $this->resolveLevels([
            'group'            => 'due_date,amount',
            'groupGranularity' => ['due_date' => 'quarter'],
            'groupRange'       => ['amount' => '100'],
        ]);

        $this->assertSame('quarter', $levels[0]->granularity);
        $this->assertSame(100, $levels[1]->range);
    }

    public function test_resolver_maps_legacy_scalar_granularity_and_range_to_first_level_only(): void {
        $date = $this->resolveLevels(['group' => 'due_date,category', 'groupGranularity' => 'year']);
        $num  = $this->resolveLevels(['group' => 'amount,category', 'groupRange' => '100']);

        $this->assertSame('year', $date[0]->granularity);
        $this->assertNull($date[1]->granularity);
        $this->assertSame(100, $num[0]->range);
        $this->assertNull($num[1]->range);
    }

    public function test_resolver_falls_back_to_effective_defaults_for_invalid_granularity_and_range(): void {
        $levels = $this->resolveLevels([
            'group'            => 'due_date,amount',
            'groupGranularity' => ['due_date' => 'decade'],
            'groupRange'       => ['amount' => '-50'],
        ]);

        $this->assertSame('month', $levels[0]->granularity);
        $this->assertSame(10, $levels[1]->range, 'Range invalid -> opsi pertama groupRangeOptions ([10, 100]).');
    }

    public function test_resolver_inherits_granularity_from_fallback_level_of_the_same_column_only(): void {
        $applied = [['column' => 'due_date', 'granularity' => 'year']];

        $sameColumn = $this->resolveLevels(['group' => 'category,due_date'], applied: $applied);
        $otherOnly  = $this->resolveLevels(['group' => 'amount'], applied: [['column' => 'amount', 'range' => 100], ['column' => 'due_date', 'granularity' => 'year']]);
        $differing  = $this->resolveLevels(['group' => 'amount'], applied: $applied);

        $this->assertSame('year', $sameColumn[1]->granularity, 'Kolom SAMA mewarisi granularity level filter.');
        $this->assertSame(100, $otherOnly[0]->range);
        $this->assertSame(10, $differing[0]->range, '?group=<kolom lain> tak boleh mewarisi setelan kolom default.');
    }

    public function test_resolver_group_options_without_group_param_override_fallback_levels(): void {
        $levels = $this->resolveLevels(
            ['groupGranularity' => 'half'],
            applied: [['column' => 'due_date', 'granularity' => 'quarter'], ['column' => 'category']],
        );

        $this->assertSame(['due_date', 'category'], $this->columnsOf($levels));
        $this->assertSame('half', $levels[0]->granularity, '?groupGranularity= eksplisit menang atas granularity filter.');
    }

    public function test_resolver_resolves_relation_level_to_foreign_key_column(): void {
        $levels = $this->resolveLevels(['group' => 'customer']);

        $this->assertTrue($levels[0]->isRelation());
        $this->assertSame('customer', $levels[0]->column);
        $this->assertSame('customer_id', $levels[0]->sqlColumn);
        $this->assertSame('dtg_records.customer_id', $levels[0]->qualified);
    }

    public function test_resolve_defaults_shares_effective_multi_level_group_without_param(): void {
        DtgMultiDefaultGroupRecord::create(['name' => 'A']);

        DtgMultiDefaultGroupRecord::dataTable($this->inertiaRequest());

        // 'name' (tidak groupable) dibuang; level lain tetap berurutan dgn nilai EFEKTIF.
        $this->assertSame(
            [
                ['column' => 'category', 'granularity' => null, 'range' => null],
                ['column' => 'due_date', 'granularity' => 'year', 'range' => null],
            ],
            Inertia::getShared('defaultGroups'),
        );
    }

    public function test_resolve_defaults_ignores_explicit_group_param(): void {
        DtgMultiDefaultGroupRecord::create(['name' => 'A']);

        // `?group=` eksplisit mengubah grup AKTIF, tapi `defaultGroups` tetap
        // "efektif tanpa param" (agar FE tahu apa yg kembali bila override dicabut).
        DtgMultiDefaultGroupRecord::dataTable($this->inertiaRequest(['group' => 'is_active']));

        $this->assertSame(['category', 'due_date'], array_column(Inertia::getShared('defaultGroups'), 'column'));
    }

    // ---------------------------------------------------------------------
    // Node grup: nested, predikat path per tipe, total, paging (spec
    // datatable2-group-tree, Requirement 5-6, 8; Property 1, 2, 7)
    // ---------------------------------------------------------------------

    /**
     * 6 baris: fruit(3) / vegetable(2) / tanpa kategori(1), campur boolean,
     * tanggal & angka -- cukup utk nested 3 level.
     */
    private function seedNestedRecords(): void {
        DtgRecord::create(['name' => 'F1', 'category' => 'fruit', 'is_active' => true, 'due_date' => '2026-01-10', 'amount' => 5]);
        DtgRecord::create(['name' => 'F2', 'category' => 'fruit', 'is_active' => true, 'due_date' => '2026-01-20', 'amount' => 15]);
        DtgRecord::create(['name' => 'F3', 'category' => 'fruit', 'is_active' => false, 'due_date' => '2026-02-01', 'amount' => 12]);
        DtgRecord::create(['name' => 'V1', 'category' => 'vegetable', 'is_active' => true, 'due_date' => '2026-01-05', 'amount' => 25]);
        DtgRecord::create(['name' => 'V2', 'category' => 'vegetable', 'due_date' => '2026-03-01']);
        DtgRecord::create(['name' => 'N1', 'is_active' => false, 'amount' => 5]);
    }

    /** @return array<string, int> key => count */
    private function countsOf(array $payload): array {
        return collect($payload['data'])->pluck('count', 'key')->all();
    }

    public function test_nested_expand_returns_child_groups_under_parent_path(): void {
        $this->seedNestedRecords();

        [$status, $payload] = $this->expand(['group' => 'category,is_active', 'groupPath' => json_encode(['fruit'])]);

        $this->assertSame(200, $status);
        $this->assertSame('groups', $payload['type']);
        // Boolean: key 'true'/'false' (bukan 0/1 mentah), urut key ASC (false=0 dulu).
        $this->assertSame(['false', 'true'], array_column($payload['data'], 'key'));
        $this->assertSame(['false' => 1, 'true' => 2], $this->countsOf($payload));
        // raw = nilai SQL MENTAH yg dikirim balik FE sbg elemen groupPath (di-bind).
        $this->assertEquals([0, 1], array_column($payload['data'], 'raw'));
        $this->assertSame(1, $payload['current_page']);
        $this->assertSame(1, $payload['last_page']);
        $this->assertSame(2, $payload['total']);
    }

    public function test_children_counts_sum_to_parent_count_at_every_level(): void {
        $this->seedNestedRecords();

        $wire = ['group' => 'category,due_date,amount', 'groupRange' => ['amount' => 10]];

        // Level-0 (Inertia) -> level-1 -> level-2 -> baris daun: tiap induk harus
        // = jumlah anak-anaknya (Property 1), sampai baris riil di node daun.
        DtgRecord::dataTable($this->inertiaRequest($wire));
        $rowsSeen = 0;
        foreach (Inertia::getShared('data')->items() as $l0) {
            [, $level1] = $this->expand([...$wire, 'groupPath' => json_encode([$l0['raw']])]);
            $this->assertSame($l0['count'], array_sum(array_column($level1['data'], 'count')), "count anak level-1 di bawah {$l0['key']}");

            foreach ($level1['data'] as $l1) {
                [, $level2] = $this->expand([...$wire, 'groupPath' => json_encode([$l0['raw'], $l1['raw']])]);
                $this->assertSame($l1['count'], array_sum(array_column($level2['data'], 'count')));

                foreach ($level2['data'] as $l2) {
                    [, $leaf] = $this->expand([...$wire, 'groupPath' => json_encode([$l0['raw'], $l1['raw'], $l2['raw']])]);
                    $this->assertSame('rows', $leaf['type']);
                    $this->assertSame($l2['count'], $leaf['total']);
                    $rowsSeen += $leaf['total'];
                }
            }
        }

        $this->assertSame(6, $rowsSeen, 'Setiap baris muncul di TEPAT satu node daun (Property 2).');
    }

    public function test_leaf_rows_match_path_for_every_column_type(): void {
        $c1 = DtgCustomerStub::create(['name' => 'Acme']);
        $c2 = DtgCustomerStub::create(['name' => 'Globex']);
        DtgRecord::create(['name' => 'A', 'category' => 'fruit', 'customer_id' => $c1->id, 'is_active' => true, 'due_date' => '2026-01-10', 'amount' => 5]);
        DtgRecord::create(['name' => 'B', 'category' => 'veg', 'customer_id' => $c2->id, 'is_active' => false, 'due_date' => '2026-02-10', 'amount' => 15]);
        DtgRecord::create(['name' => 'C', 'category' => 'veg', 'customer_id' => $c2->id, 'is_active' => false, 'due_date' => '2026-02-20', 'amount' => 18]);

        $names = fn (string $group, array $path, array $extra = []) => collect(
            $this->expand(['group' => $group, 'groupPath' => json_encode($path), ...$extra])[1]['data'],
        )->pluck('name')->sort()->values()->all();

        $this->assertSame(['B', 'C'], $names('category', ['veg']), 'scalar');
        $this->assertSame(['B', 'C'], $names('customer', [$c2->id]), 'relasi -> FK');
        $this->assertSame(['A'], $names('is_active', [1]), 'boolean 1');
        $this->assertSame(['A'], $names('is_active', [true]), 'boolean true');
        $this->assertSame(['B', 'C'], $names('is_active', [0]), 'boolean 0');
        $this->assertSame(['B', 'C'], $names('due_date', ['2026-02']), 'date bucket (month)');
        $this->assertSame(['A', 'B', 'C'], $names('due_date', ['2026'], ['groupGranularity' => ['due_date' => 'year']]), 'date bucket (year)');
        $this->assertSame(['B', 'C'], $names('amount', [10], ['groupRange' => ['amount' => 10]]), 'number bucket [10,20)');
        $this->assertSame(['A'], $names('amount', [0], ['groupRange' => ['amount' => 10]]), 'number bucket [0,10)');
    }

    public function test_null_group_path_returns_rows_with_null_value(): void {
        DtgRecord::create(['name' => 'Has', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'None1']);
        DtgRecord::create(['name' => 'None2']);

        [, $payload] = $this->expand(['group' => 'category', 'groupPath' => json_encode([null])]);

        $this->assertSame(['None1', 'None2'], collect($payload['data'])->pluck('name')->sort()->values()->all());
        $this->assertSame(2, $payload['total']);
    }

    public function test_number_bucket_path_supports_fractional_range_and_negative_values(): void {
        DtgRecord::create(['name' => 'Low', 'amount' => 0.3]);
        DtgRecord::create(['name' => 'Mid', 'amount' => 0.7]);
        DtgRecord::create(['name' => 'High', 'amount' => 1.2]);
        DtgRecord::create(['name' => 'Neg', 'amount' => -5]);

        // Fractional: [0.5, 1.0) hanya 'Mid' -- predikat rentang aman utk float.
        $frac = $this->expand(['group' => 'amount', 'groupRange' => ['amount' => 0.5], 'groupPath' => json_encode([0.5])])[1];
        $this->assertSame(['Mid'], array_column($frac['data'], 'name'));

        // Negatif: bucket -10 = [-10, 0) berisi 'Neg' saja (floor(-0.5) = -1).
        $neg = $this->expand(['group' => 'amount', 'groupRange' => ['amount' => 10], 'groupPath' => json_encode([-10])])[1];
        $this->assertSame(['Neg'], array_column($neg['data'], 'name'));
    }

    public function test_form_statuses_variants_merge_and_leaf_returns_rows_of_every_variant(): void {
        DB::table('dtg_records')->insert([
            ['name' => 'A', 'statuses' => '["approved", "pending"]'],
            ['name' => 'B', 'statuses' => '["approved","pending"]'],
            ['name' => 'C', 'statuses' => '["draft"]'],
        ]);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'statuses']));
        $merged = collect(Inertia::getShared('data')->items())->firstWhere('key', '["approved","pending"]');

        $this->assertSame(2, $merged['count']);
        // raw = daftar SEMUA varian teks mentah yg menormalisasi ke key yang sama.
        $this->assertCount(2, $merged['raw']);

        [, $leaf] = $this->expand(['group' => 'statuses', 'groupPath' => json_encode([$merged['raw']])]);
        $this->assertSame(['A', 'B'], collect($leaf['data'])->pluck('name')->sort()->values()->all());
    }

    public function test_relation_level_below_level_zero_returns_label_object(): void {
        $c1 = DtgCustomerStub::create(['name' => 'Acme']);
        DtgRecord::create(['name' => 'A', 'category' => 'fruit', 'customer_id' => $c1->id]);
        DtgRecord::create(['name' => 'B', 'category' => 'fruit']);

        [, $payload] = $this->expand(['group' => 'category,customer', 'groupPath' => json_encode(['fruit'])]);

        $labels = collect($payload['data'])->keyBy('key')->map(fn ($g) => $g['label']['name'] ?? null)->all();
        $this->assertSame(['null' => null, (string) $c1->id => 'Acme'], $labels);
    }

    public function test_group_meta_shares_effective_levels_and_types(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'category,due_date,amount']));
        $meta = Inertia::getShared('groupMeta');

        $this->assertSame(['category', 'due_date', 'amount'], array_column($meta['levels'], 'column'));
        $this->assertSame([null, 'month', null], array_column($meta['levels'], 'granularity'));
        $this->assertSame([null, null, 10], array_column($meta['levels'], 'range'));
        $this->assertSame(['date', 'number'], [$meta['levels'][1]['type'], $meta['levels'][2]['type']]);
        $this->assertSame([], $meta['aggregates']);
    }

    public function test_total_group_count_query_is_skipped_when_first_page_is_not_full(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'a']);
        DtgRecord::create(['name' => 'B', 'category' => 'b']);

        $countSubqueries = function (array $params): int {
            DB::flushQueryLog();
            DB::enableQueryLog();
            DtgRecord::dataTable($this->inertiaRequest($params));
            $queries = collect(DB::getQueryLog())->pluck('query');
            DB::disableQueryLog();

            return $queries->filter(fn ($q) => preg_match('/from \(select .*group_key/is', $q))->count();
        };

        // show=10, 2 grup -> halaman 1 tak penuh: total = jumlah hasil, TANPA query total.
        $this->assertSame(0, $countSubqueries(['group' => 'category', 'show' => 10]));
        // show=1, 2 grup -> halaman penuh: total dihitung lewat subquery.
        $this->assertSame(1, $countSubqueries(['group' => 'category', 'show' => 1]));
    }

    public function test_show_limits_each_child_list_and_group_page_paginates_independently(): void {
        $this->seedNestedRecords();
        // fruit punya 2 anak (is_active true/false), vegetable 2 anak (true/null).
        $base = ['group' => 'category,is_active', 'show' => 1];

        [, $p1]    = $this->expand([...$base, 'groupPath' => json_encode(['fruit']), 'groupPage' => 1]);
        [, $p2]    = $this->expand([...$base, 'groupPath' => json_encode(['fruit']), 'groupPage' => 2]);
        [, $other] = $this->expand([...$base, 'groupPath' => json_encode(['vegetable']), 'groupPage' => 1]);

        $this->assertCount(1, $p1['data'], '`show` membatasi list sub-grup.');
        $this->assertSame(2, $p1['last_page']);
        $this->assertSame(2, $p1['total']);
        $this->assertSame(['false'], array_column($p1['data'], 'key'));
        $this->assertSame(['true'], array_column($p2['data'], 'key'));
        // Halaman node fruit tak mempengaruhi node vegetable (Property 7).
        $this->assertSame(['null'], array_column($other['data'], 'key'));

        // Leaf: paginate($show) per node juga.
        [, $leaf] = $this->expand([...$base, 'groupPath' => json_encode(['fruit', 1]), 'groupPage' => 1]);
        $this->assertSame('rows', $leaf['type']);
        $this->assertSame(2, $leaf['total']);
        $this->assertCount(1, $leaf['data']);
        $this->assertSame(2, $leaf['last_page']);
    }

    // ---------------------------------------------------------------------
    // Protokol expand, paritas constraint, keamanan (Requirement 7, 10;
    // Property 3, 4, 5, 7)
    // ---------------------------------------------------------------------

    /**
     * @return array<string, array{0: mixed}>
     */
    public static function invalidGroupPaths(): array {
        return [
            'bukan JSON'                   => ['ini-bukan-json'],
            'objek, bukan list'            => ['{"a":1}'],
            'lebih panjang dari level'     => [json_encode(['fruit', 'x'])],
            'elemen array di level skalar' => [json_encode([['fruit']])],
            'elemen objek di level skalar' => [json_encode([['a' => 1]])],
        ];
    }

    #[DataProvider('invalidGroupPaths')]
    public function test_expand_with_invalid_group_path_returns_422_not_500(string $groupPath): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        [$status, $payload] = $this->expand(['group' => 'category', 'groupPath' => $groupPath]);

        $this->assertSame(422, $status);
        $this->assertArrayHasKey('groupPath', $payload['errors']);
    }

    public function test_expand_rejects_non_numeric_value_on_number_bucket_and_non_list_on_form_statuses(): void {
        DtgRecord::create(['name' => 'A', 'amount' => 5]);

        $this->assertSame(422, $this->expand(['group' => 'amount', 'groupPath' => json_encode(['abc'])])[0]);
        $this->assertSame(422, $this->expand(['group' => 'statuses', 'groupPath' => json_encode(['["draft"]'])])[0]);
        $this->assertSame(422, $this->expand(['group' => 'statuses', 'groupPath' => json_encode([[1]])])[0]);
        // Tetap sah: numerik (string/angka) & null.
        $this->assertSame(200, $this->expand(['group' => 'amount', 'groupPath' => json_encode(['10'])])[0]);
        $this->assertSame(200, $this->expand(['group' => 'amount', 'groupPath' => json_encode([null])])[0]);
    }

    public function test_expand_without_valid_group_levels_returns_422(): void {
        DtgDefaultGroupRecord::create(['name' => 'A', 'category' => 'fruit']);

        // `name` tidak groupable & XHR tidak memakai default model -> tak ada level.
        $this->assertSame(422, $this->expand(['group' => 'name', 'groupPath' => '[]'], model: DtgDefaultGroupRecord::class)[0]);
        $this->assertSame(422, $this->expand(['groupPath' => '[]'], model: DtgDefaultGroupRecord::class)[0]);
    }

    public function test_expand_with_empty_path_returns_level_zero_groups_as_json(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        [$status, $payload] = $this->expand(['group' => 'category', 'groupPath' => '[]']);

        $this->assertSame(200, $status);
        $this->assertSame('groups', $payload['type']);
        $this->assertSame(['fruit'], array_column($payload['data'], 'key'));
    }

    public function test_group_page_invalid_is_treated_as_first_page_and_out_of_range_returns_empty_data(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'a']);
        DtgRecord::create(['name' => 'B', 'category' => 'b']);
        $base = ['group' => 'category', 'groupPath' => '[]', 'show' => 1];

        foreach (['abc', '0', '-3'] as $bad) {
            $payload = $this->expand([...$base, 'groupPage' => $bad])[1];
            $this->assertSame(1, $payload['current_page'], "groupPage=$bad -> halaman 1");
        }

        $far = $this->expand([...$base, 'groupPage' => 99])[1];
        $this->assertSame([], $far['data']);
        $this->assertSame(2, $far['total'], 'total tetap benar walau halaman di luar rentang.');
    }

    public function test_xhr_without_group_path_ignores_group_and_returns_flat_rows(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'B', 'category' => 'veg']);

        DB::enableQueryLog();
        $result  = DtgRecord::dataTable($this->ajax(['group' => 'category']));
        $queries = collect(DB::getQueryLog())->pluck('query')->implode(' | ');
        DB::disableQueryLog();

        $this->assertCount(2, $result['data']->items());
        $this->assertInstanceOf(DtgRecord::class, $result['data']->items()[0], 'XHR biasa tetap menerima BARIS, bukan deskriptor grup.');
        $this->assertStringNotContainsStringIgnoringCase('group by', $queries);
    }

    public function test_no_group_returns_flat_row_paginator_and_null_group_meta(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        DtgRecord::dataTable($this->inertiaRequest());

        $this->assertInstanceOf(DtgRecord::class, Inertia::getShared('data')->items()[0], 'Tanpa grouping: paginator BARIS (Property 4).');
        $this->assertNull(Inertia::getShared('groupMeta'));
    }

    public function test_group_nodes_use_the_same_constraints_as_the_flat_path_saved_filter(): void {
        $user = User::factory()->create();
        DtgRecord::create(['name' => 'Fruit 1', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Fruit 2', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Veg 1', 'category' => 'vegetable']);

        $saved = SavedFilter::create([
            'user_id' => $user->id, 'model' => DtgRecord::class, 'is_saved' => true,
            'filter'  => ['root' => ['k' => 'and', 'c' => ['i1' => ['k' => 'name', 'o' => '!=', 'v' => 'Fruit 1']]]],
        ]);
        $wire = ['group' => 'category', 'fid' => $saved->id];

        DtgRecord::dataTable($this->inertiaRequest($wire));
        $this->assertGroupCounts(['fruit' => 1, 'vegetable' => 1], $this->levelZeroCounts());

        [, $leaf] = $this->expand([...$wire, 'groupPath' => json_encode(['fruit'])]);
        $this->assertSame(['Fruit 2'], array_column($leaf['data'], 'name'), 'Node daun ikut filter aktif.');
    }

    public function test_group_nodes_use_the_same_constraints_as_the_flat_path_default_shared_filter(): void {
        $user = User::factory()->create();
        DtgRecord::create(['name' => 'Fruit 1', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Fruit 2', 'category' => 'fruit']);

        SavedFilter::create([
            'user_id'   => $user->id, 'model' => DtgRecord::class, 'name' => 'Default', 'is_saved' => true,
            'is_shared' => true, 'is_default' => true,
            'filter'    => ['root' => ['k' => 'and', 'c' => ['i1' => ['k' => 'name', 'o' => '!=', 'v' => 'Fruit 1']]]],
        ]);

        // Request expand TANPA `fid`: default shared filter tetap terapkan (sama spt level-0).
        [, $leaf] = $this->expand(['group' => 'category', 'groupPath' => json_encode(['fruit'])]);
        $this->assertSame(['Fruit 2'], array_column($leaf['data'], 'name'));
    }

    public function test_group_nodes_use_the_same_constraints_as_the_flat_path_controller_scope(): void {
        DtgRecord::create(['name' => 'Keep 1', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Keep 2', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Hidden', 'category' => 'fruit']);

        // Meniru controller yg mem-scope query SEBELUM macro (scopeVisible,
        // sharedListing, Unit::orderBy, ...): node level-0 & daun harus ikut.
        $scoped = fn () => DtgRecord::where('name', '!=', 'Hidden');

        $scoped()->dataTable($this->inertiaRequest(['group' => 'category']));
        $this->assertGroupCounts(['fruit' => 2], $this->levelZeroCounts());

        try {
            $scoped()->dataTable($this->ajax(['group' => 'category', 'groupPath' => json_encode(['fruit'])]));
            $this->fail('expand harus menghentikan request');
        } catch (HttpResponseException $e) {
            $names = collect($e->getResponse()->getData(true)['data'])->pluck('name')->sort()->values()->all();
        }

        $this->assertSame(['Keep 1', 'Keep 2'], $names);
    }

    public function test_group_path_values_are_bound_never_interpolated(): void {
        $evil = "O'Brien\"; DROP TABLE dtg_records; --";
        DtgRecord::create(['name' => 'Evil', 'category' => $evil]);
        DtgRecord::create(['name' => 'Other', 'category' => 'fruit']);

        [$status, $payload] = $this->expand(['group' => 'category', 'groupPath' => json_encode([$evil])]);

        $this->assertSame(200, $status);
        $this->assertSame(['Evil'], array_column($payload['data'], 'name'));
        $this->assertSame(2, DtgRecord::count(), 'Tabel utuh -- nilai path tak pernah masuk SQL mentah.');
    }

    public function test_leaf_node_respects_visible_columns_cookie(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit', 'locked_field' => 'secret']);

        $cookie      = $this->dtCookie(['name' => ['order' => 0]]);
        [, $payload] = $this->expand(['group' => 'category', 'groupPath' => json_encode(['fruit'])], $cookie);

        $row = $payload['data'][0];
        $this->assertSame('A', $row['name']);
        $this->assertArrayNotHasKey('locked_field', $row, 'Adaptive select existing berlaku utk node daun.');
    }

    // ---------------------------------------------------------------------
    // Agregat baris grup (`groupAggregate`, spec datatable2-group-tree,
    // Requirement 9; Property 8)
    // ---------------------------------------------------------------------

    private function seedAggregateRecords(): void {
        DtgAggregateRecord::create(['name' => 'F1', 'category' => 'fruit', 'is_active' => true, 'amount' => 10.50, 'qty' => 1, 'price' => 3.25, 'weight' => 1.5]);
        DtgAggregateRecord::create(['name' => 'F2', 'category' => 'fruit', 'is_active' => true, 'amount' => 20.25, 'qty' => 2, 'price' => 1.75, 'weight' => 4.0]);
        DtgAggregateRecord::create(['name' => 'F3', 'category' => 'fruit', 'is_active' => false, 'amount' => 5, 'qty' => 6, 'price' => 9.00, 'weight' => 2.5]);
        // vegetable: semua kolom agregat NULL -> agregat harus null (bukan 0).
        DtgAggregateRecord::create(['name' => 'V1', 'category' => 'vegetable', 'is_active' => true]);
        DtgAggregateRecord::create(['name' => 'V2', 'category' => 'vegetable', 'is_active' => true]);
    }

    /** @return array{0: int, 1: array<string, mixed>} */
    private function expandAggregate(array $query): array {
        return $this->expand($query, model: DtgAggregateRecord::class);
    }

    public function test_aggregates_at_level_zero_match_manual_sum_avg_min_max(): void {
        $this->seedAggregateRecords();

        DtgAggregateRecord::dataTable($this->inertiaRequest(['group' => 'category']));
        $groups = collect(Inertia::getShared('data')->items())->keyBy('key');

        $fruit = $groups['fruit']['aggregates'];
        $this->assertEqualsWithDelta(35.75, $fruit['amount'], 0.0001, 'sum');
        $this->assertEqualsWithDelta(3.0, $fruit['qty'], 0.0001, 'avg = (1+2+6)/3');
        $this->assertEqualsWithDelta(1.75, $fruit['price'], 0.0001, 'min');
        $this->assertEqualsWithDelta(4.0, $fruit['weight'], 0.0001, 'max');
        // Bandingkan dgn agregat manual atas baris yg sama (Property 8).
        $rows = DtgAggregateRecord::where('category', 'fruit');
        $this->assertEqualsWithDelta((float) $rows->sum('amount'), $fruit['amount'], 0.0001);
        $this->assertEqualsWithDelta((float) $rows->avg('qty'), $fruit['qty'], 0.0001);
    }

    public function test_aggregates_are_null_when_every_value_is_null(): void {
        $this->seedAggregateRecords();

        DtgAggregateRecord::dataTable($this->inertiaRequest(['group' => 'category']));
        $veg = collect(Inertia::getShared('data')->items())->firstWhere('key', 'vegetable')['aggregates'];

        // assertEquals: urutan key agregat mengikuti urutan kolom getColumns(), tak bermakna.
        $this->assertEquals(['amount' => null, 'qty' => null, 'price' => null, 'weight' => null], $veg);
    }

    public function test_aggregates_are_computed_at_every_level_of_nested_groups(): void {
        $this->seedAggregateRecords();
        $wire = ['group' => 'category,is_active'];

        [, $level1] = $this->expandAggregate([...$wire, 'groupPath' => json_encode(['fruit'])]);
        $byKey      = collect($level1['data'])->keyBy('key');

        // fruit > is_active=true : F1 + F2
        $this->assertEqualsWithDelta(30.75, $byKey['true']['aggregates']['amount'], 0.0001);
        $this->assertEqualsWithDelta(1.5, $byKey['true']['aggregates']['qty'], 0.0001);
        $this->assertEqualsWithDelta(1.75, $byKey['true']['aggregates']['price'], 0.0001);
        $this->assertEqualsWithDelta(4.0, $byKey['true']['aggregates']['weight'], 0.0001);
        // fruit > is_active=false : F3
        $this->assertEqualsWithDelta(5.0, $byKey['false']['aggregates']['amount'], 0.0001);
        $this->assertEqualsWithDelta(6.0, $byKey['false']['aggregates']['qty'], 0.0001);
    }

    public function test_group_meta_lists_only_valid_aggregates_and_invalid_config_is_ignored_silently(): void {
        $this->seedAggregateRecords();

        DtgAggregateRecord::dataTable($this->inertiaRequest(['group' => 'category']));
        $meta = Inertia::getShared('groupMeta');

        // Valid: amount(sum) qty(avg) price(min) weight(max). DITOLAK: name (string),
        // customer (relasi), locked_field (fungsi 'median'), double_amount (turunan).
        $aggregates = collect($meta['aggregates'])->sortBy('column')->values()->all();
        $this->assertEquals(
            [
                ['column' => 'amount', 'fn' => 'sum'],
                ['column' => 'price', 'fn' => 'min'],
                ['column' => 'qty', 'fn' => 'avg'],
                ['column' => 'weight', 'fn' => 'max'],
            ],
            $aggregates,
        );

        foreach (Inertia::getShared('data')->items() as $group) {
            $keys = array_keys($group['aggregates']);
            sort($keys);
            $this->assertSame(['amount', 'price', 'qty', 'weight'], $keys);
        }
    }

    public function test_leaf_rows_and_models_without_aggregate_config_carry_no_aggregates(): void {
        $this->seedAggregateRecords();

        [, $leaf] = $this->expandAggregate(['group' => 'category', 'groupPath' => json_encode(['fruit'])]);
        $this->assertSame('rows', $leaf['type']);
        $this->assertArrayNotHasKey('aggregates', $leaf['data'][0]);

        DtgRecord::create(['name' => 'X', 'category' => 'fruit', 'amount' => 5]);
        DtgRecord::dataTable($this->inertiaRequest(['group' => 'category']));
        $this->assertSame([], Inertia::getShared('groupMeta')['aggregates']);
        $this->assertSame([], Inertia::getShared('data')->items()[0]['aggregates']);
    }

    public function test_avg_and_sum_stay_correct_when_form_status_variants_are_merged_into_one_group(): void {
        DB::table('dtg_records')->insert([
            ['name' => 'A', 'statuses' => '["approved", "pending"]', 'qty' => 2, 'amount' => 10],
            ['name' => 'B', 'statuses' => '["approved","pending"]', 'qty' => 4, 'amount' => 20],
            ['name' => 'C', 'statuses' => '["approved","pending"]', 'qty' => null, 'amount' => 30],
        ]);

        DtgAggregateRecord::dataTable($this->inertiaRequest(['group' => 'statuses']));
        $group = collect(Inertia::getShared('data')->items())->firstWhere('key', '["approved","pending"]');

        $this->assertSame(3, $group['count']);
        $this->assertEqualsWithDelta(60.0, $group['aggregates']['amount'], 0.0001, 'sum lintas 2 baris SQL yg digabung');
        // AVG mengabaikan NULL: (2+4)/2 = 3, BUKAN rata-rata per baris SQL lalu dirata-ratakan lagi.
        $this->assertEqualsWithDelta(3.0, $group['aggregates']['qty'], 0.0001);
    }

    // ---------------------------------------------------------------------
    // Urutan baris grup: agregat sort-tabel & `groupSort` (arah nilai grup)
    // ---------------------------------------------------------------------

    private function seedOrderingRecords(): void {
        // amount(sum): a=30 b=10 c=20 | qty(avg): a=1.5 b=1 c=2 | price(min): a=5 b=9 c=1 | weight(max): a=7 b=3 c=5
        DtgAggregateRecord::create(['name' => 'a1', 'category' => 'a', 'is_active' => true, 'amount' => 10, 'qty' => 1, 'price' => 5, 'weight' => 7]);
        DtgAggregateRecord::create(['name' => 'a2', 'category' => 'a', 'is_active' => false, 'amount' => 20, 'qty' => 2, 'price' => 8, 'weight' => 2]);
        DtgAggregateRecord::create(['name' => 'b1', 'category' => 'b', 'is_active' => true, 'amount' => 4, 'qty' => 1, 'price' => 9, 'weight' => 3]);
        DtgAggregateRecord::create(['name' => 'b2', 'category' => 'b', 'is_active' => true, 'amount' => 6, 'qty' => 1, 'price' => 9, 'weight' => 1]);
        DtgAggregateRecord::create(['name' => 'c1', 'category' => 'c', 'is_active' => true, 'amount' => 20, 'qty' => 2, 'price' => 1, 'weight' => 5]);
        DtgAggregateRecord::create(['name' => 'n1', 'category' => null, 'is_active' => true, 'amount' => 1, 'qty' => 9, 'price' => 7, 'weight' => 9]);
    }

    /** @return list<string> kunci grup level-0 berurutan */
    private function levelZeroKeys(array $query): array {
        DtgAggregateRecord::dataTable($this->inertiaRequest(['group' => 'category', ...$query]));

        return array_column(Inertia::getShared('data')->items(), 'key');
    }

    public function test_group_rows_default_to_key_ascending_with_null_first_and_ignore_non_aggregate_sort(): void {
        $this->seedOrderingRecords();

        $this->assertSame(['null', 'a', 'b', 'c'], $this->levelZeroKeys([]));
        // Sort tabel ke kolom BUKAN agregat (name/created_at) tak memengaruhi urutan grup.
        $this->assertSame(['null', 'a', 'b', 'c'], $this->levelZeroKeys(['sort' => '-name']));
        $this->assertSame(['null', 'a', 'b', 'c'], $this->levelZeroKeys(['sort' => 'name']));
    }

    public function test_group_rows_follow_table_sort_when_it_targets_an_aggregate_column(): void {
        $this->seedOrderingRecords();

        // sum(amount): null=1 b=10 c=20 a=30
        $this->assertSame(['null', 'b', 'c', 'a'], $this->levelZeroKeys(['sort' => 'amount']));
        $this->assertSame(['a', 'c', 'b', 'null'], $this->levelZeroKeys(['sort' => '-amount']));
        // avg(qty): b=1 a=1.5 c=2 null=9 -- a=1.5 harus di antara b & c (bukan dibulatkan jadi 1).
        $this->assertSame(['b', 'a', 'c', 'null'], $this->levelZeroKeys(['sort' => 'qty']));
        $this->assertSame(['null', 'c', 'a', 'b'], $this->levelZeroKeys(['sort' => '-qty']));
        // min(price): c=1 a=5 null=7 b=9
        $this->assertSame(['c', 'a', 'null', 'b'], $this->levelZeroKeys(['sort' => 'price']));
        // max(weight): b=3 c=5 a=7 null=9
        $this->assertSame(['b', 'c', 'a', 'null'], $this->levelZeroKeys(['sort' => 'weight']));
    }

    public function test_group_sort_param_reverses_key_order_and_breaks_aggregate_ties(): void {
        $this->seedOrderingRecords();

        $this->assertSame(['c', 'b', 'a', 'null'], $this->levelZeroKeys(['groupSort' => 'desc']));
        // Nilai tak valid -> asc (tak error).
        $this->assertSame(['null', 'a', 'b', 'c'], $this->levelZeroKeys(['groupSort' => 'sideways']));
        // Agregat sudah membedakan semua grup (sum amount: null=1 b=10 c=20 a=30) ->
        // groupSort hanya pemutus seri dan tak mengubah urutan ini.
        $this->assertSame(['null', 'b', 'c', 'a'], $this->levelZeroKeys(['sort' => 'amount', 'groupSort' => 'desc']));
    }

    public function test_group_sort_breaks_ties_between_equal_aggregates_by_key_direction(): void {
        DtgAggregateRecord::create(['name' => 'x', 'category' => 'x', 'amount' => 10]);
        DtgAggregateRecord::create(['name' => 'y', 'category' => 'y', 'amount' => 10]);
        DtgAggregateRecord::create(['name' => 'z', 'category' => 'z', 'amount' => 3]);

        $this->assertSame(['z', 'x', 'y'], $this->levelZeroKeys(['sort' => 'amount']));
        $this->assertSame(['z', 'y', 'x'], $this->levelZeroKeys(['sort' => 'amount', 'groupSort' => 'desc']));
    }

    public function test_sub_group_lists_and_paging_use_the_same_ordering_and_group_sort_leaves_leaf_rows_alone(): void {
        $this->seedOrderingRecords();
        $wire = ['group' => 'category,is_active'];

        // a > is_active: false(amount 20) , true(amount 10)
        [, $asc]  = $this->expandAggregate([...$wire, 'groupPath' => json_encode(['a']), 'sort' => 'amount']);
        [, $desc] = $this->expandAggregate([...$wire, 'groupPath' => json_encode(['a']), 'sort' => '-amount']);
        $this->assertSame(['true', 'false'], array_column($asc['data'], 'key'));
        $this->assertSame(['false', 'true'], array_column($desc['data'], 'key'));

        [, $byKeyDesc] = $this->expandAggregate([...$wire, 'groupPath' => json_encode(['a']), 'groupSort' => 'desc']);
        $this->assertSame(['true', 'false'], array_column($byKeyDesc['data'], 'key'));

        // Halaman berurutan tetap utuh & tanpa duplikat saat diurut agregat (show=1).
        $seen = [];
        for ($page = 1; $page <= 4; $page++) {
            DtgAggregateRecord::dataTable($this->inertiaRequest(['group' => 'category', 'sort' => '-amount', 'show' => 1, 'page' => $page]));
            $seen[] = Inertia::getShared('data')->items()[0]['key'];
        }
        $this->assertSame(['a', 'c', 'b', 'null'], $seen);

        // Leaf: urutan baris = sort tabel; groupSort tak menyentuhnya.
        [, $leaf] = $this->expandAggregate(['group' => 'category', 'groupPath' => json_encode(['a']), 'sort' => 'name', 'groupSort' => 'desc']);
        $this->assertSame(['a1', 'a2'], array_column($leaf['data'], 'name'));
    }

    // ---------------------------------------------------------------------
    // Data besar (600 baris): invarian pohon grup bertingkat vs query langsung
    // ---------------------------------------------------------------------

    /**
     * @return array{customerIds: list<int>, bigLeaf: int} bigLeaf = jumlah baris leaf terbesar
     */
    private function seedLargeDataset(): array {
        mt_srand(42);
        $categories  = ['a', 'b', 'c', 'd', 'e'];
        $customerIds = [];
        for ($i = 1; $i <= 12; $i++) {
            $customerIds[] = DtgCustomerStub::create(['name' => "C{$i}"])->id;
        }

        $rows = [];
        // Leaf besar (>show): category a > customer 1 > is_active true = 130 baris.
        for ($i = 0; $i < 130; $i++) {
            $rows[] = ['category' => 'a', 'customer_id' => $customerIds[0], 'is_active' => true];
        }
        // Sisanya tersebar acak; ~1 dari 9 baris tanpa customer (grup NULL).
        for ($i = 0; $i < 470; $i++) {
            $rows[] = [
                'category'    => $categories[mt_rand(0, 4)],
                'customer_id' => mt_rand(0, 8) === 8 ? null : $customerIds[mt_rand(0, 11)],
                'is_active'   => (bool) mt_rand(0, 1),
            ];
        }
        foreach ($rows as $index => &$row) {
            $row += ['name' => "R{$index}", 'amount' => mt_rand(1, 500), 'qty' => mt_rand(0, 40), 'price' => mt_rand(1, 90), 'weight' => mt_rand(1, 70)];
        }
        unset($row);
        foreach (array_chunk($rows, 100) as $chunk) {
            DB::table('dtg_records')->insert($chunk);
        }

        return ['customerIds' => $customerIds, 'bigLeaf' => 130];
    }

    public function test_large_dataset_level_zero_pages_cover_every_group_once_with_correct_counts_and_aggregates(): void {
        $this->seedLargeDataset();
        $this->assertSame(600, DB::table('dtg_records')->count());

        $truth = DB::table('dtg_records')
            ->selectRaw('category, count(*) c, sum(amount) s, avg(qty) a, min(price) mn, max(weight) mx')
            ->groupBy('category')->get()->keyBy('category');

        $seen = [];
        $sum  = 0;
        // show=2 -> 5 kategori = 3 halaman luar (2,2,1).
        for ($page = 1; $page <= 3; $page++) {
            DtgAggregateRecord::dataTable($this->inertiaRequest(['group' => 'category,customer,is_active', 'show' => 2, 'page' => $page]));
            $paginator = Inertia::getShared('data');
            $this->assertSame(5, $paginator->total());
            $this->assertLessThanOrEqual(2, count($paginator->items()));

            foreach ($paginator->items() as $group) {
                $expected = $truth[$group['key']];
                $this->assertSame((int) $expected->c, $group['count'], "count {$group['key']}");
                $this->assertEqualsWithDelta((float) $expected->s, $group['aggregates']['amount'], 0.001, "sum {$group['key']}");
                $this->assertEqualsWithDelta((float) $expected->a, $group['aggregates']['qty'], 0.001, "avg {$group['key']}");
                $this->assertEqualsWithDelta((float) $expected->mn, $group['aggregates']['price'], 0.001, "min {$group['key']}");
                $this->assertEqualsWithDelta((float) $expected->mx, $group['aggregates']['weight'], 0.001, "max {$group['key']}");
                $seen[$group['key']] = ($seen[$group['key']] ?? 0) + 1;
                $sum += $group['count'];
            }
        }

        $this->assertSame(['a' => 1, 'b' => 1, 'c' => 1, 'd' => 1, 'e' => 1], $seen, 'tiap grup tepat sekali lintas halaman');
        $this->assertSame(600, $sum, 'jumlah count semua grup = total baris');
    }

    public function test_large_dataset_sub_group_lists_sum_to_parent_and_put_null_first(): void {
        $this->seedLargeDataset();

        [$status, $payload] = $this->expandAggregate(['group' => 'category,customer,is_active', 'groupPath' => json_encode(['a']), 'show' => 100]);
        $this->assertSame(200, $status);
        $this->assertSame('groups', $payload['type']);

        $parent = DB::table('dtg_records')->where('category', 'a')->count();
        $this->assertSame($parent, array_sum(array_column($payload['data'], 'count')), 'jumlah anak = count induk');
        $this->assertArrayHasKey('raw', $payload['data'][0]);
        $this->assertNull($payload['data'][0]['raw'], 'grup NULL (customer kosong) tampil paling awal');
        $this->assertSame(
            DB::table('dtg_records')->where('category', 'a')->distinct()->count('customer_id') + (DB::table('dtg_records')->where('category', 'a')->whereNull('customer_id')->exists() ? 1 : 0),
            $payload['total'],
        );
    }

    public function test_large_dataset_leaf_pagination_is_independent_disjoint_and_complete(): void {
        ['customerIds' => $customerIds, 'bigLeaf' => $bigLeaf] = $this->seedLargeDataset();
        $path                                                  = json_encode(['a', $customerIds[0], true]);
        $truth                                                 = DB::table('dtg_records')->where('category', 'a')->where('customer_id', $customerIds[0])->where('is_active', true)->pluck('id')->all();
        $this->assertGreaterThanOrEqual($bigLeaf, count($truth));

        foreach ([25, 100] as $show) {
            $pages     = (int) ceil(count($truth) / $show);
            $collected = [];
            for ($page = 1; $page <= $pages; $page++) {
                [$status, $payload] = $this->expandAggregate(['group' => 'category,customer,is_active', 'groupPath' => $path, 'show' => $show, 'groupPage' => $page]);
                $this->assertSame(200, $status);
                $this->assertSame('rows', $payload['type']);
                $this->assertSame(count($truth), $payload['total']);
                $this->assertSame($show, $payload['per_page']);
                $this->assertLessThanOrEqual($show, count($payload['data']));
                array_push($collected, ...array_column($payload['data'], 'id'));
            }

            $this->assertCount(count($truth), $collected, "show={$show}: jumlah baris lintas halaman");
            $this->assertCount(count($truth), array_unique($collected), "show={$show}: halaman tak boleh tumpang tindih");
            $this->assertEqualsCanonicalizing($truth, $collected, "show={$show}: himpunan baris = query langsung");

            // Halaman di luar jangkauan -> kosong, bukan error.
            [$status, $payload] = $this->expandAggregate(['group' => 'category,customer,is_active', 'groupPath' => $path, 'show' => $show, 'groupPage' => $pages + 5]);
            $this->assertSame(200, $status);
            $this->assertSame([], $payload['data']);
        }
    }
}

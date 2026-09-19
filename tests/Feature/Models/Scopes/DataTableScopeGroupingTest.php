<?php

namespace Tests\Feature\Models\Scopes;

use App\Casts\FormStatusesCast;
use App\Enums\FormStatus;
use App\Models\Core\SavedFilter;
use App\Models\Model as AppModel;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
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
    protected static ?string $defaultGroupColumn = 'category';
}

/** Default group SALAH: 'name' tidak groupable -- harus diabaikan diam-diam. */
class DtgBadDefaultGroupRecord extends DtgRecord {
    protected static ?string $defaultGroupColumn = 'name';
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
                $t->text('tags')->nullable();
                $t->date('due_date')->nullable();
                $t->decimal('amount', 10, 2)->nullable();
                $t->boolean('is_active')->nullable();
                $t->text('notes')->nullable();
                $t->text('statuses')->nullable();
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

    public function test_group_counts_accurate_across_pages(): void {
        foreach (range(1, 3) as $i) {
            DtgRecord::create(['name' => "Fruit $i", 'category' => 'fruit']);
        }
        foreach (range(1, 2) as $i) {
            DtgRecord::create(['name' => "Veg $i", 'category' => 'vegetable']);
        }

        // show=2 -> 1 halaman cuma sebagian data, tapi groupCounts tetap total.
        // Jalur Inertia (isInertiaRequest=true) return null dari closure macro --
        // paginator dibaca dari Inertia::getShared('data'), bukan return value.
        DtgRecord::dataTable($this->inertiaRequest(['group' => 'category', 'show' => 2]));
        $paginator = Inertia::getShared('data');

        $this->assertSame(2, $paginator->count(), 'Baris tetap flat-paginated, tidak berubah.');
        $this->assertGroupCounts(
            ['fruit' => 3, 'vegetable' => 2],
            Inertia::getShared('groupCounts'),
            'groupCounts akurat lintas SEMUA data, bukan cuma baris di halaman aktif (Property 1).',
        );
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

        $groupCounts = Inertia::getShared('groupCounts');
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
            Inertia::getShared('groupCounts'),
        );
    }

    public function test_group_not_groupable_column_returns_null_and_skips_query(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        DB::enableQueryLog();
        DtgRecord::dataTable($this->inertiaRequest(['group' => 'name']));
        $queries = collect(DB::getQueryLog())->pluck('query')->implode(' | ');
        DB::disableQueryLog();

        $this->assertNull(Inertia::getShared('groupCounts'), 'Kolom "name" tidak groupable -> null (Property 2).');
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
            Inertia::getShared('groupCounts'),
            'GROUP BY pakai kolom FK riil (customer_id), di-key sbg string id (match row.customer.id di FE).',
        );
        // Row penuh (bukan cuma FK id) tetap ter-eager-load -- FE butuh object
        // relasi utuh utk convertTemplateLink() label grup + ekstrak primaryKey.
        $items = Inertia::getShared('data')->items();
        $this->assertTrue($items[0]->relationLoaded('customer'));
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

    public function test_group_scalar_column_value_present_even_when_excluded_from_visible_columns_cookie(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        // Cookie HANYA menampilkan "name" -- "category" (kolom grup) sengaja
        // tidak disertakan, simulasi account_type yg bukan kolom tampil sendiri.
        $cookie = $this->dtCookie(['name' => ['order' => 0]]);

        $result = DtgRecord::dataTable($this->ajax(['group' => 'category'], $cookie));
        $row    = $result['data']->items()[0];

        $this->assertArrayHasKey(
            'category',
            $row->getAttributes(),
            'Kolom grup harus tetap ter-SELECT walau tak ada di cookie kolom visible.',
        );
        $this->assertSame('fruit', $row->category);
    }

    public function test_group_relation_column_eager_loaded_even_when_excluded_from_visible_columns_cookie(): void {
        $c1 = DtgCustomerStub::create(['name' => 'Acme']);
        DtgRecord::create(['name' => 'A', 'customer_id' => $c1->id]);

        // Cookie HANYA "name" -- "customer" (kolom grup relasi) sengaja
        // tidak disertakan.
        $cookie = $this->dtCookie(['name' => ['order' => 0]]);

        $result = DtgRecord::dataTable($this->ajax(['group' => 'customer'], $cookie));
        $row    = $result['data']->items()[0];

        $this->assertTrue(
            $row->relationLoaded('customer'),
            'Relasi kolom grup harus tetap ter-eager-load walau tak ada di cookie kolom visible.',
        );
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
            Inertia::getShared('groupCounts'),
            'Relasi HasOne ditolak walau type-nya "relation" & groupable:true di config.',
        );
    }

    public function test_group_blank_render_type_rejected_even_if_misconfigured_groupable(): void {
        // 'tags' type-nya di-override 'json' via config -- Cell.jsx (FE) render
        // blank utk type ini, jadi tidak boleh jadi opsi Group by sama sekali.
        DtgRecord::create(['name' => 'A', 'tags' => '["x"]']);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'tags']));

        $this->assertNull(
            Inertia::getShared('groupCounts'),
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
            Inertia::getShared('groupCounts'),
            'Type "html" ditolak walau groupable:true di config.',
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
            Inertia::getShared('groupCounts'),
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

    public function test_group_relation_sql_orders_by_foreign_key_even_without_explicit_sort_param(): void {
        // Beda dari mekanisme lama (sort HARUS eksplisit dikunci ke kolom grup
        // dari FE) -- sekarang grup SELALU jadi ORDER BY primer di backend,
        // independen dari `?sort=` yg dikirim (atau tidak dikirim sama sekali).
        $c1 = DtgCustomerStub::create(['name' => 'Acme']);
        $c2 = DtgCustomerStub::create(['name' => 'Globex']);
        DtgRecord::create(['name' => 'A', 'customer_id' => $c2->id]);
        DtgRecord::create(['name' => 'B', 'customer_id' => $c1->id]);
        DtgRecord::create(['name' => 'C', 'customer_id' => $c2->id]);
        DtgRecord::create(['name' => 'D', 'customer_id' => $c1->id]);

        // TANPA ?sort= sama sekali -- fallback sort (created_at desc) cuma jadi
        // tie-breaker SEKUNDER, bukan mengacak urutan grup.
        $result = DtgRecord::dataTable($this->ajax(['group' => 'customer']));
        $ids    = collect($result['data']->items())->pluck('customer_id')->all();

        $this->assertSame([$c1->id, $c1->id, $c2->id, $c2->id], $ids);
    }

    public function test_group_sort_secondary_tie_breaks_within_group(): void {
        // Sort pilihan user ("name" asc) jadi tie-breaker DALAM tiap grup
        // (category) -- grup primer tetap nempel bersebelahan, TAPI urutan
        // baris di dalam grup ikut sort user, bukan default (created_at).
        DtgRecord::create(['name' => 'Zeta', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Alpha', 'category' => 'fruit']);
        DtgRecord::create(['name' => 'Yankee', 'category' => 'vegetable']);
        DtgRecord::create(['name' => 'Bravo', 'category' => 'vegetable']);

        $result = DtgRecord::dataTable($this->ajax(['group' => 'category', 'sort' => 'name']));
        $names  = collect($result['data']->items())->pluck('name')->all();

        $this->assertSame(['Alpha', 'Zeta', 'Bravo', 'Yankee'], $names);
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
            Inertia::getShared('groupCounts'),
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
            Inertia::getShared('groupCounts'),
        );

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date', 'groupGranularity' => 'quarter']));
        $this->assertGroupCounts(
            ['2026-Q1' => 1, '2026-Q2' => 1, '2026-Q3' => 1, '2026-Q4' => 1],
            Inertia::getShared('groupCounts'),
        );

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date', 'groupGranularity' => 'half']));
        $this->assertGroupCounts(
            ['2026-H1' => 2, '2026-H2' => 2],
            Inertia::getShared('groupCounts'),
        );

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date', 'groupGranularity' => 'year']));
        $this->assertGroupCounts(
            ['2026' => 4],
            Inertia::getShared('groupCounts'),
        );
    }

    public function test_group_date_invalid_granularity_falls_back_to_month(): void {
        DtgRecord::create(['name' => 'A', 'due_date' => '2026-01-15']);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'due_date', 'groupGranularity' => 'decade']));

        $this->assertGroupCounts(['2026-01' => 1], Inertia::getShared('groupCounts'));
    }

    public function test_group_date_bucket_rows_stay_contiguous_in_paginated_result(): void {
        // Baris SEBENARNYA punya due_date berbeda dalam bulan yg sama --
        // ORDER BY primer harus pakai ekspresi bucket YANG SAMA (bukan raw
        // due_date), kalau tidak baris "sebulan" bisa tersebar/tak nempel.
        DtgRecord::create(['name' => 'A', 'due_date' => '2026-02-01']);
        DtgRecord::create(['name' => 'B', 'due_date' => '2026-01-28']);
        DtgRecord::create(['name' => 'C', 'due_date' => '2026-01-01']);

        $result = DtgRecord::dataTable($this->ajax(['group' => 'due_date']));
        $months = collect($result['data']->items())
            ->map(fn ($r) => substr($r->due_date, 0, 7))
            ->all();

        $this->assertSame(['2026-01', '2026-01', '2026-02'], $months);
    }

    public function test_group_number_default_range_uses_first_configured_option(): void {
        // Stub 'amount' groupRangeOptions: [10, 100] -- tanpa ?groupRange=,
        // default pakai opsi PERTAMA (10).
        DtgRecord::create(['name' => 'A', 'amount' => 5]);
        DtgRecord::create(['name' => 'B', 'amount' => 12]);
        DtgRecord::create(['name' => 'C', 'amount' => 19]);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'amount']));

        // floor(5/10)*10=0, floor(12/10)*10=10, floor(19/10)*10=10.
        $this->assertGroupCounts(['0' => 1, '10' => 2], Inertia::getShared('groupCounts'));
    }

    public function test_group_number_explicit_range(): void {
        DtgRecord::create(['name' => 'A', 'amount' => 150]);
        DtgRecord::create(['name' => 'B', 'amount' => 180]);
        DtgRecord::create(['name' => 'C', 'amount' => 250]);

        DtgRecord::dataTable($this->inertiaRequest(['group' => 'amount', 'groupRange' => 100]));

        // floor(150/100)*100=100, floor(180/100)*100=100, floor(250/100)*100=200.
        $this->assertGroupCounts(['100' => 2, '200' => 1], Inertia::getShared('groupCounts'));
    }

    public function test_group_number_invalid_range_falls_back_to_default(): void {
        DtgRecord::create(['name' => 'A', 'amount' => 5]);

        foreach (['-50', '0', 'abc'] as $badRange) {
            DtgRecord::dataTable($this->inertiaRequest(['group' => 'amount', 'groupRange' => $badRange]));
            // Fallback ke opsi pertama (10): floor(5/10)*10=0.
            $this->assertGroupCounts(
                ['0' => 1],
                Inertia::getShared('groupCounts'),
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

        $this->assertGroupCounts(['fruit' => 2, 'vegetable' => 2], Inertia::getShared('groupCounts'));
        $this->assertSame('category', Inertia::getShared('defaultGroup'));
        $this->assertSame(
            ['fruit', 'fruit', 'vegetable', 'vegetable'],
            collect(Inertia::getShared('data')->items())->pluck('category')->all(),
            'Baris se-grup harus bersebelahan (sort primer by kolom default group).',
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

        $this->assertNull(Inertia::getShared('groupCounts'));
        // Default tetap dibagikan supaya FE tahu harus kirim `group=` kosong
        // (bukan menghilangkan param) saat user memilih "Tidak ada".
        $this->assertSame('category', Inertia::getShared('defaultGroup'));
    }

    public function test_explicit_group_param_overrides_default_group(): void {
        DtgDefaultGroupRecord::create(['name' => 'A', 'category' => 'fruit', 'is_active' => true]);
        DtgDefaultGroupRecord::create(['name' => 'B', 'category' => 'fruit', 'is_active' => false]);

        DtgDefaultGroupRecord::dataTable($this->inertiaRequest(['group' => 'is_active']));

        $this->assertGroupCounts(['true' => 1, 'false' => 1], Inertia::getShared('groupCounts'));
    }

    public function test_default_group_on_non_groupable_column_is_ignored(): void {
        DtgBadDefaultGroupRecord::create(['name' => 'A']);

        DtgBadDefaultGroupRecord::dataTable($this->inertiaRequest());

        $this->assertNull(Inertia::getShared('groupCounts'));
        $this->assertNull(Inertia::getShared('defaultGroup'));
    }

    public function test_model_without_default_group_is_not_grouped_and_shares_null_default(): void {
        DtgRecord::create(['name' => 'A', 'category' => 'fruit']);

        DtgRecord::dataTable($this->inertiaRequest());

        $this->assertNull(Inertia::getShared('groupCounts'));
        $this->assertNull(Inertia::getShared('defaultGroup'));
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
            Inertia::getShared('groupCounts'),
            'groupCounts dihitung dari row-set yang SAMA dengan data.data -- ikut filter aktif (Property 3).',
        );
        $this->assertSame(3, Inertia::getShared('data')->count());
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
        $this->assertNull(Inertia::getShared('groupCounts'));
    }
}

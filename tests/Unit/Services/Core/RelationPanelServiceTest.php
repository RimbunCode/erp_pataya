<?php

namespace Tests\Unit\Services\Core;

use App\Models\Core\ModelConnection;
use App\Models\Model as AppModel;
use App\Models\User\User;
use App\Services\Core\Connection\RelationPanelService;
use App\Services\Core\PermissionChecker;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Dokumen sumber yang mendeklarasikan dua panel, meniru PurchaseOrder.
 */
class RpTestSourceDocument extends AppModel {
    use HasUlids;

    protected $table   = 'rp_test_sources';
    protected $guarded = ['id'];
    protected $casts   = ['remainder_rows' => 'array'];

    public static function expectedRelationPanels(): array {
        return [
            RpTestTargetDocument::class => [
                'action' => [
                    'route'      => 'rpTestTargets.create',
                    'params'     => ['ref' => 'rpTestSource/{id}'],
                    'label'      => 'rp.actions.create_target',
                    'permission' => 'create',
                ],
                'remainder' => [
                    'title'   => 'rp.panel.remainder.title',
                    'columns' => [
                        ['key' => 'item', 'label' => 'rp.panel.item', 'align' => 'left'],
                        ['key' => 'remaining', 'label' => 'rp.panel.remaining', 'align' => 'right', 'format' => 'number'],
                    ],
                    'rows' => 'remainderRows',
                ],
            ],
            RpTestOtherTargetDocument::class => ['action' => null],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function remainderRows(): array {
        return $this->remainder_rows ?? [];
    }
}

/**
 * Tujuan relasi dengan kolom ber-aggregate dan relasi eager, meniru PurchaseReceipt.
 */
class RpTestTargetDocument extends AppModel {
    use HasUlids;

    protected $table   = 'rp_test_targets';
    protected $guarded = ['id'];

    public function lines(): HasMany {
        return $this->hasMany(RpTestTargetLine::class, 'rp_test_target_id');
    }

    public static function relationPanel(): array {
        return [
            'title'   => 'rp.panel.target.title',
            'columns' => [
                ['key' => 'code', 'label' => 'rp.panel.code', 'align' => 'left'],
                ['key' => 'total_quantity', 'label' => 'rp.panel.quantity', 'align' => 'right', 'format' => 'number', 'aggregate' => 'sum'],
                // Menampilkan nilai mata uang transaksi, menjumlahkan nilai
                // mata uang dasar. Meniru kolom total PurchaseInvoice.
                ['key' => 'total', 'label' => 'rp.panel.total', 'align' => 'right', 'format' => 'currency', 'aggregate' => 'sum', 'aggregate_key' => 'total_base'],
            ],
        ];
    }

    /**
     * Rincian per baris memuat relasi lines. Panel tidak mendeklarasikan eager
     * sendiri, jadi relasi ini hanya dimuat lewat eager rincian: bila digabung
     * dengan benar, jumlah query tidak tumbuh per baris.
     */
    public static function relationPanelDetail(): array {
        return [
            'columns' => [
                ['key' => 'item', 'label' => 'rp.detail.item', 'align' => 'left'],
                ['key' => 'quantity', 'label' => 'rp.detail.quantity', 'align' => 'right', 'format' => 'number'],
            ],
            'eager' => ['lines'],
        ];
    }

    public function relationPanelDetailRows(): array {
        return $this->lines
            ->map(fn (RpTestTargetLine $line): array => ['item' => $line->label, 'quantity' => $line->quantity])
            ->all();
    }

    public function relationPanelRow(): array {
        return [
            'code'           => $this->code,
            'total_quantity' => $this->lines->sum('quantity'),
            'total'          => $this->amount ?? 0,
            'total_base'     => $this->amount_base ?? 0,
        ];
    }
}

class RpTestTargetLine extends AppModel {
    use HasUlids;

    protected $table   = 'rp_test_target_lines';
    protected $guarded = ['id'];
}

/**
 * Tujuan relasi submitable, meniru PurchaseReceipt: draft milik user lain tidak
 * boleh terbaca sebagai baris panel.
 */
class RpTestSubmitableTargetDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'rp_test_submitable_targets';
    protected $guarded = ['id'];

    public static function relationPanel(): array {
        return [
            'title'   => 'rp.panel.submitable.title',
            'columns' => [
                ['key' => 'code', 'label' => 'rp.panel.code', 'align' => 'left'],
            ],
        ];
    }
}

/**
 * Sumber yang hanya menunjuk ke dokumen submitable.
 */
class RpTestSubmitableSourceDocument extends AppModel {
    use HasUlids;

    protected $table   = 'rp_test_submitable_sources';
    protected $guarded = ['id'];

    public static function expectedRelationPanels(): array {
        return [
            RpTestSubmitableTargetDocument::class => ['action' => null],
        ];
    }
}

/**
 * Tujuan relasi tanpa kolom aggregate dan tanpa aksi, memakai relationPanelRow() default.
 */
class RpTestOtherTargetDocument extends AppModel {
    use HasUlids;

    protected $table   = 'rp_test_other_targets';
    protected $guarded = ['id'];

    public static function relationPanel(): array {
        return [
            'title'   => 'rp.panel.other.title',
            'columns' => [
                ['key' => 'code', 'label' => 'rp.panel.code', 'align' => 'left'],
            ],
        ];
    }
}

/**
 * Sumber dengan panel `source`, meniru PurchaseReceipt yang punya retur.
 */
class RpTestReturnSourceDocument extends AppModel {
    use HasUlids;

    protected $table   = 'rp_test_sources';
    protected $guarded = ['id'];

    public static function expectedRelationPanels(): array {
        return [
            RpTestTargetDocument::class => ['action' => null, 'source' => 'returnRows'],
        ];
    }

    public function returnRows(): Builder {
        return RpTestTargetDocument::query()->where('parent_id', $this->getKey());
    }
}

/**
 * Sumber dengan panel `source` ke tipe submitable, meniru retur yang punya draft.
 */
class RpTestSubmitableReturnSourceDocument extends AppModel {
    use HasUlids;

    protected $table   = 'rp_test_submitable_sources';
    protected $guarded = ['id'];

    public static function expectedRelationPanels(): array {
        return [
            RpTestSubmitableTargetDocument::class => ['action' => null, 'source' => 'returnRows'],
        ];
    }

    public function returnRows(): Builder {
        return RpTestSubmitableTargetDocument::query()->where('parent_id', $this->getKey());
    }
}

/**
 * Sumber yang salah: method `source` mengembalikan relasi, bukan query builder.
 */
class RpTestBadSourceDocument extends AppModel {
    use HasUlids;

    protected $table   = 'rp_test_sources';
    protected $guarded = ['id'];

    public static function expectedRelationPanels(): array {
        return [
            RpTestTargetDocument::class => ['action' => null, 'source' => 'relationRows'],
        ];
    }

    public function relationRows() {
        return $this->hasMany(RpTestTargetDocument::class, 'parent_id');
    }
}

class RelationPanelServiceTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        Schema::create('rp_test_sources', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->nullable();
            $table->json('remainder_rows')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('rp_test_targets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('parent_id')->nullable();
            $table->string('code')->nullable();
            $table->ulid('created_by_id')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->json('status')->nullable();
            $table->double('amount')->default(0);
            $table->double('amount_base')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('rp_test_target_lines', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('rp_test_target_id');
            $table->string('label')->nullable();
            $table->integer('quantity')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('rp_test_other_targets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('rp_test_submitable_sources', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('rp_test_submitable_targets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('parent_id')->nullable();
            $table->string('code')->nullable();
            $table->ulid('created_by_id')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->json('status')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Route::get('/rp-test/targets/create', fn () => 'ok')->name('rpTestTargets.create');
        // ->name() dipasang setelah rute masuk koleksi, jadi indeks nama perlu disegarkan.
        app('router')->getRoutes()->refreshNameLookups();

        // Penjagaan baris panel membaca request()->user(), jadi butuh user aktif.
        $this->user = User::factory()->create();
        $this->actingAs($this->user);

        // Default tanpa permission. Test yang butuh izin memanggil grantCreateOnTargets().
        app()->instance(PermissionChecker::class, new PermissionChecker([]));
    }

    protected function tearDown(): void {
        Schema::dropIfExists('rp_test_submitable_targets');
        Schema::dropIfExists('rp_test_submitable_sources');
        Schema::dropIfExists('rp_test_target_lines');
        Schema::dropIfExists('rp_test_targets');
        Schema::dropIfExists('rp_test_other_targets');
        Schema::dropIfExists('rp_test_sources');

        parent::tearDown();
    }

    /**
     * Permission default test: boleh membaca baris panel dan membuat dokumen
     * tujuan, pada kedua model tujuan. Test keamanan memanggil grantOnTargets()
     * langsung untuk menyusun kombinasi lain.
     */
    private function grantCreateOnTargets(): void {
        $this->grantOnTargets(['read' => true, 'create' => true]);
    }

    /**
     * @param  array<string, bool>  $permissions
     */
    private function grantOnTargets(array $permissions, bool $onlyCreator = false): void {
        $entry = [0 => [[
            'permissions'  => $permissions,
            'only_creator' => $onlyCreator,
        ]]];

        app()->instance(PermissionChecker::class, new PermissionChecker([
            RpTestTargetDocument::class      => $entry,
            RpTestOtherTargetDocument::class => $entry,
        ]));
    }

    private function makeTarget(string $code, int ...$quantities): RpTestTargetDocument {
        $target = RpTestTargetDocument::create([
            'code'          => $code,
            'created_by_id' => $this->user->getKey(),
            'submitted_at'  => now(),
        ]);
        foreach ($quantities as $quantity) {
            RpTestTargetLine::create(['rp_test_target_id' => $target->id, 'label' => 'Kertas A4', 'quantity' => $quantity]);
        }

        return $target;
    }

    private function connect(AppModel $document, AppModel $target): void {
        ModelConnection::createConnection([
            'model_type'     => $document::class,
            'model_id'       => $document->id,
            'reference_type' => $target::class,
            'reference_id'   => $target->id,
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $panels
     * @return array<string, mixed>
     */
    private function panelFor(array $panels, string $referenceType): array {
        $matches = array_values(array_filter(
            $panels,
            fn (array $panel): bool => $panel['reference_type'] === $referenceType,
        ));
        $this->assertCount(1, $matches);

        return $matches[0];
    }

    private function countQueries(callable $callback): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $callback();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }

    #[Test]
    public function payload_lists_linked_rows_with_columns_title_and_route(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-001']);
        $this->grantCreateOnTargets();
        $first  = $this->makeTarget('TGT-001', 3);
        $second = $this->makeTarget('TGT-002', 5);
        $this->connect($source, $first);
        $this->connect($source, $second);

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertSame('rp.panel.target.title', $panel['title']);
        $this->assertSame(['code', 'total_quantity', 'total'], array_column($panel['columns'], 'key'));
        $this->assertFalse($panel['is_empty']);
        $this->assertCount(2, $panel['rows']);
        $this->assertSame(['TGT-001', 'TGT-002'], collect($panel['rows'])->pluck('code')->sort()->values()->all());
        $this->assertContains($first->id, array_column($panel['rows'], 'id'));
        $this->assertSame('rpTestTargetDocuments.show', $panel['route']);
    }

    #[Test]
    public function sum_aggregate_adds_quantities_and_plain_columns_get_no_total(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-002']);
        $this->grantCreateOnTargets();
        $this->connect($source, $this->makeTarget('TGT-003', 3));
        $this->connect($source, $this->makeTarget('TGT-004', 5));

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertSame(8, $panel['totals']['total_quantity']);
        $this->assertArrayNotHasKey('code', $panel['totals']);
    }

    /**
     * Kolom uang menampilkan nilai mata uang transaksi tetapi menjumlahkan
     * nilai mata uang dasar, karena dokumen pada satu induk boleh berbeda
     * mata uang. Tanpa aggregate_key, baris total menjumlahkan angka yang
     * tidak sebanding.
     */
    #[Test]
    public function aggregate_key_sums_a_different_row_value_than_the_one_displayed(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-012']);
        $this->grantCreateOnTargets();

        foreach ([[100.0, 1_600_000.0], [50.0, 800_000.0]] as [$amount, $amountBase]) {
            $target = RpTestTargetDocument::create([
                'code'          => 'TGT-CUR-' . (int) $amount,
                'created_by_id' => $this->user->getKey(),
                'submitted_at'  => now(),
                'amount'        => $amount,
                'amount_base'   => $amountBase,
            ]);
            $this->connect($source, $target);
        }

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        // Baris tetap menampilkan nilai asli dokumen.
        $this->assertSame([50.0, 100.0], collect($panel['rows'])->pluck('total')->sort()->values()->all());
        // Total memakai nilai mata uang dasar, bukan 150 dari penjumlahan di atas.
        $this->assertSame(2_400_000.0, $panel['totals']['total']);
    }

    #[Test]
    public function panel_without_aggregate_column_has_no_totals(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-003']);
        $this->grantCreateOnTargets();
        $other = RpTestOtherTargetDocument::create(['code' => 'OTH-001']);
        $this->connect($source, $other);

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestOtherTargetDocument::class);

        $this->assertSame([], $panel['totals']);
        $this->assertFalse($panel['is_empty']);
    }

    #[Test]
    public function declared_panels_without_connections_are_empty_and_keep_their_action(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-004']);
        $this->grantCreateOnTargets();

        $panels = (new RelationPanelService)->build($source);

        $this->assertCount(2, $panels);

        $target = $this->panelFor($panels, RpTestTargetDocument::class);
        $this->assertTrue($target['is_empty']);
        $this->assertSame([], $target['rows']);
        $this->assertNotNull($target['action']);

        $other = $this->panelFor($panels, RpTestOtherTargetDocument::class);
        $this->assertTrue($other['is_empty']);
        $this->assertNull($other['action']);
        $this->assertSame([], $other['totals']);
    }

    #[Test]
    public function audit_rows_with_free_form_reference_types_are_skipped_without_error(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-005']);
        $this->grantCreateOnTargets();
        $this->connect($source, $this->makeTarget('TGT-005', 4));

        foreach (['sync', 'mark_done'] as $marker) {
            ModelConnection::createConnection([
                'model_type'     => $source::class,
                'model_id'       => $source->id,
                'reference_type' => $marker,
                'reference_id'   => (string) Str::ulid(),
                'data'           => ['type' => 'items_sync'],
            ]);
        }

        $panels = (new RelationPanelService)->build($source);

        $this->assertCount(2, $panels);
        $panel = $this->panelFor($panels, RpTestTargetDocument::class);
        $this->assertSame(['TGT-005'], collect($panel['rows'])->pluck('code')->all());
    }

    #[Test]
    public function action_is_null_without_the_permission_on_the_target_model(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-006']);

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertNull($panel['action']);
    }

    #[Test]
    public function action_url_replaces_the_document_placeholder_with_its_id(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-007']);
        $this->grantCreateOnTargets();

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertSame('rp.actions.create_target', $panel['action']['label']);
        $this->assertStringContainsString('/rp-test/targets/create', $panel['action']['url']);

        parse_str((string) parse_url($panel['action']['url'], PHP_URL_QUERY), $query);
        $this->assertSame('rpTestSource/' . $source->id, $query['ref']);
    }

    /**
     * Baris panel adalah data dokumen lain, jadi hak akses atas dokumen yang
     * sedang dibuka tidak cukup. Tanpa permission read pada model tujuan,
     * panel tetap muncul tetapi kosong.
     */
    #[Test]
    public function rows_are_hidden_without_read_permission_on_the_target_model(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-009']);
        $this->grantOnTargets(['create' => true]);
        $this->connect($source, $this->makeTarget('TGT-013', 4));

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertSame([], $panel['rows']);
        $this->assertTrue($panel['is_empty']);
    }

    /**
     * Permission yang hanya berlaku lewat entry only_creator membatasi baris ke
     * dokumen buatan user sendiri, sama seperti filter created_by_id di listing.
     */
    #[Test]
    public function only_creator_permission_limits_rows_to_documents_made_by_the_user(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-010']);
        $this->grantOnTargets(['read' => true], onlyCreator: true);

        $mine = $this->makeTarget('TGT-014', 2);
        $this->connect($source, $mine);

        $someoneElse = RpTestTargetDocument::create([
            'code'          => 'TGT-015',
            'created_by_id' => User::factory()->create()->getKey(),
            'submitted_at'  => now(),
        ]);
        $this->connect($source, $someoneElse);

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertSame(['TGT-014'], collect($panel['rows'])->pluck('code')->all());
    }

    /**
     * Dokumen submitable yang belum disubmit hanya terlihat oleh pembuatnya,
     * guard yang sama dengan macro dataTable().
     */
    #[Test]
    public function unsubmitted_documents_of_other_users_are_not_listed(): void {
        $source = RpTestSubmitableSourceDocument::create(['code' => 'SRC-011']);
        app()->instance(PermissionChecker::class, new PermissionChecker([
            RpTestSubmitableTargetDocument::class => [0 => [[
                'permissions'  => ['read' => true],
                'only_creator' => false,
            ]]],
        ]));

        $submitted = RpTestSubmitableTargetDocument::create([
            'code'          => 'TGT-016',
            'created_by_id' => User::factory()->create()->getKey(),
            'submitted_at'  => now(),
        ]);
        $this->connect($source, $submitted);

        $draftOfSomeoneElse = RpTestSubmitableTargetDocument::create([
            'code'          => 'TGT-017',
            'created_by_id' => User::factory()->create()->getKey(),
            'submitted_at'  => null,
        ]);
        $this->connect($source, $draftOfSomeoneElse);

        $myDraft = RpTestSubmitableTargetDocument::create([
            'code'          => 'TGT-018',
            'created_by_id' => $this->user->getKey(),
            'submitted_at'  => null,
        ]);
        $this->connect($source, $myDraft);

        $panel = $this->panelFor(
            (new RelationPanelService)->build($source),
            RpTestSubmitableTargetDocument::class,
        );

        $this->assertSame(
            ['TGT-016', 'TGT-018'],
            collect($panel['rows'])->pluck('code')->sort()->values()->all(),
        );
    }

    #[Test]
    public function document_without_declared_panels_returns_empty_array(): void {
        $document = RpTestOtherTargetDocument::create(['code' => 'OTH-002']);
        $this->connect($document, RpTestTargetDocument::create(['code' => 'TGT-006']));

        $this->assertSame([], (new RelationPanelService)->build($document));
    }

    #[Test]
    public function query_count_does_not_grow_with_the_number_of_rows(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-008']);
        $this->grantCreateOnTargets();
        $this->connect($source, $this->makeTarget('TGT-007', 1, 2));
        $this->connect($source, $this->makeTarget('TGT-008', 3));

        $service = new RelationPanelService;
        $fewRows = $this->countQueries(fn () => $service->build($source));

        foreach (['TGT-009', 'TGT-010', 'TGT-011', 'TGT-012'] as $code) {
            $this->connect($source, $this->makeTarget($code, 1, 1));
        }

        $manyRows = $this->countQueries(fn () => $service->build($source));

        $this->assertGreaterThan(0, $fewRows);
        $this->assertSame($fewRows, $manyRows);
    }

    #[Test]
    public function detail_rows_are_attached_to_each_row_and_columns_to_the_panel(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-020']);
        $this->grantCreateOnTargets();
        $this->connect($source, $this->makeTarget('TGT-020', 2, 3));

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertSame(['item', 'quantity'], array_column($panel['detail_columns'], 'key'));
        $detailRows = $panel['rows'][0]['detail_rows'];
        $this->assertCount(2, $detailRows);
        $this->assertSame(['Kertas A4', 'Kertas A4'], array_column($detailRows, 'item'));
        $this->assertSame([2, 3], collect($detailRows)->pluck('quantity')->sort()->values()->all());
    }

    #[Test]
    public function model_without_detail_declaration_gets_no_detail_keys(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-021']);
        $this->grantCreateOnTargets();
        $this->connect($source, RpTestOtherTargetDocument::create(['code' => 'OTH-010']));

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestOtherTargetDocument::class);

        $this->assertArrayNotHasKey('detail_columns', $panel);
        $this->assertArrayNotHasKey('detail_rows', $panel['rows'][0]);
    }

    #[Test]
    public function empty_remainder_is_not_sent(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-022', 'remainder_rows' => []]);
        $this->grantCreateOnTargets();
        $this->connect($source, $this->makeTarget('TGT-021', 1));

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertArrayNotHasKey('remainder', $panel);
    }

    #[Test]
    public function remainder_is_sent_with_its_title_columns_and_rows_when_rows_exist(): void {
        $source = RpTestSourceDocument::create([
            'code'           => 'SRC-023',
            'remainder_rows' => [['item' => 'Map', 'remaining' => 6]],
        ]);
        $this->grantCreateOnTargets();

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertSame('rp.panel.remainder.title', $panel['remainder']['title']);
        $this->assertSame(['item', 'remaining'], array_column($panel['remainder']['columns'], 'key'));
        $this->assertSame([['item' => 'Map', 'remaining' => 6]], $panel['remainder']['rows']);
    }

    /**
     * Rincian per baris memuat relasi lines lewat eager rincian. Menambah baris
     * dengan lebih banyak line tidak boleh menambah jumlah query.
     */
    #[Test]
    public function detail_rows_add_no_queries_per_row(): void {
        $source = RpTestSourceDocument::create(['code' => 'SRC-024']);
        $this->grantCreateOnTargets();
        $this->connect($source, $this->makeTarget('TGT-022', 1, 2));

        $service = new RelationPanelService;
        $fewRows = $this->countQueries(fn () => $service->build($source));

        foreach (['TGT-023', 'TGT-024', 'TGT-025'] as $code) {
            $this->connect($source, $this->makeTarget($code, 4, 5, 6));
        }

        $manyRows = $this->countQueries(fn () => $service->build($source));

        $this->assertSame($fewRows, $manyRows);
        $panel = $this->panelFor($service->build($source), RpTestTargetDocument::class);
        $this->assertCount(4, $panel['rows']);
    }

    /**
     * Panel `source` mengambil baris dari builder dan tidak menyentuh model_connections.
     */
    #[Test]
    public function source_panel_reads_rows_from_the_builder_without_model_connections(): void {
        $source = RpTestReturnSourceDocument::create(['code' => 'SRC-030']);
        $this->grantCreateOnTargets();
        RpTestTargetDocument::create([
            'code'          => 'RET-001',
            'parent_id'     => $source->id,
            'created_by_id' => $this->user->getKey(),
            'submitted_at'  => now(),
        ]);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $panels  = (new RelationPanelService)->build($source);
        $queries = array_column(DB::getQueryLog(), 'query');
        DB::disableQueryLog();

        $panel = $this->panelFor($panels, RpTestTargetDocument::class);
        $this->assertSame(['RET-001'], collect($panel['rows'])->pluck('code')->all());
        foreach ($queries as $query) {
            $this->assertStringNotContainsString('model_connections', $query);
        }
    }

    #[Test]
    public function source_panel_is_hidden_without_read_permission(): void {
        $source = RpTestReturnSourceDocument::create(['code' => 'SRC-031']);
        $this->grantOnTargets(['create' => true]);
        RpTestTargetDocument::create([
            'code'          => 'RET-002',
            'parent_id'     => $source->id,
            'created_by_id' => $this->user->getKey(),
            'submitted_at'  => now(),
        ]);

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertSame([], $panel['rows']);
    }

    #[Test]
    public function source_panel_respects_only_creator_permission(): void {
        $source = RpTestReturnSourceDocument::create(['code' => 'SRC-032']);
        $this->grantOnTargets(['read' => true], onlyCreator: true);
        RpTestTargetDocument::create([
            'code'          => 'RET-MINE',
            'parent_id'     => $source->id,
            'created_by_id' => $this->user->getKey(),
            'submitted_at'  => now(),
        ]);
        RpTestTargetDocument::create([
            'code'          => 'RET-OTHER',
            'parent_id'     => $source->id,
            'created_by_id' => User::factory()->create()->getKey(),
            'submitted_at'  => now(),
        ]);

        $panel = $this->panelFor((new RelationPanelService)->build($source), RpTestTargetDocument::class);

        $this->assertSame(['RET-MINE'], collect($panel['rows'])->pluck('code')->all());
    }

    /**
     * Guard draft berlaku juga untuk panel `source`: draft milik user lain disembunyikan.
     */
    #[Test]
    public function source_panel_hides_unsubmitted_drafts_of_other_users(): void {
        $source = RpTestSubmitableReturnSourceDocument::create(['code' => 'SRC-033']);
        app()->instance(PermissionChecker::class, new PermissionChecker([
            RpTestSubmitableTargetDocument::class => [0 => [[
                'permissions'  => ['read' => true],
                'only_creator' => false,
            ]]],
        ]));

        RpTestSubmitableTargetDocument::create([
            'code'          => 'RET-SUBMITTED',
            'parent_id'     => $source->id,
            'created_by_id' => User::factory()->create()->getKey(),
            'submitted_at'  => now(),
        ]);
        RpTestSubmitableTargetDocument::create([
            'code'          => 'RET-DRAFT-OTHER',
            'parent_id'     => $source->id,
            'created_by_id' => User::factory()->create()->getKey(),
            'submitted_at'  => null,
        ]);
        RpTestSubmitableTargetDocument::create([
            'code'          => 'RET-DRAFT-MINE',
            'parent_id'     => $source->id,
            'created_by_id' => $this->user->getKey(),
            'submitted_at'  => null,
        ]);

        $panel = $this->panelFor(
            (new RelationPanelService)->build($source),
            RpTestSubmitableTargetDocument::class,
        );

        $this->assertSame(
            ['RET-DRAFT-MINE', 'RET-SUBMITTED'],
            collect($panel['rows'])->pluck('code')->sort()->values()->all(),
        );
    }

    /**
     * Method `source` yang mengembalikan relasi ditolak, supaya tidak ada jalur
     * yang melewati penjagaan loadRecords().
     */
    #[Test]
    public function source_method_returning_a_relation_is_rejected(): void {
        $source = RpTestBadSourceDocument::create(['code' => 'SRC-034']);
        $this->grantCreateOnTargets();

        $this->expectException(\LogicException::class);

        (new RelationPanelService)->build($source);
    }
}

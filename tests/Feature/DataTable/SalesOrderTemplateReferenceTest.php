<?php

namespace Tests\Feature\DataTable;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\PrintTemplate;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use App\Services\Core\DataTable\Template\ExpressionSql;
use App\Services\Core\DataTableConfigCache;
use App\Services\Core\DataTableConfigValidator;
use App\Services\Core\FilterEvaluator;
use App\Services\Core\PrintTemplate\RelationTrackerService;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Model nyata referensi fitur template kolom: SalesOrder (kolom template + isLink, kolom progress
 * donut & bar berbasis expression subquery, kolom virtual template opt-in pencarian, chip items,
 * mobileTemplate). Juga memastikan `expression` tak bocor lewat jalur lain ke frontend.
 */
class SalesOrderTemplateReferenceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            LanguageMiddleware::class,
            QueryDetectorMiddleware::class,
        ]);

        // Kolom `status` (Submitable) ditambah dinamis oleh initPermissions(), bukan migration statis.
        foreach ([User::class, FormatingSeries::class, SalesOrder::class] as $model) {
            $model::initPermissions();
        }
    }

    /** @return array<string, array<string, mixed>> */
    private function columns(): array {
        return collect(SalesOrder::computeColumnsFlat(true))->keyBy('name')->all();
    }

    private function makeOrder(string $code, ?string $customerName = null, ?User $creator = null): SalesOrder {
        return SalesOrder::create([
            'code'          => $code,
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => $customerName ?? "Pelanggan {$code}", 'is_disabled' => false])->id,
            'created_by_id' => ($creator ?? User::factory()->create())->id,
        ]);
    }

    private function addItem(SalesOrder $order, float $quantity, float $delivered, float $billed, bool $deleted = false): void {
        // Baris item minimal tanpa membuat ItemVariant: tunda cek FK sampai commit (transaksi test di-rollback).
        DB::statement('PRAGMA defer_foreign_keys = ON');
        DB::table('sales_order_items')->insert([
            'id'                 => (string) Str::ulid(),
            'sales_order_id'     => $order->id,
            'item_id'            => (string) Str::ulid(),
            'quantity'           => $quantity,
            'delivered_quantity' => $delivered,
            'billed_quantity'    => $billed,
            'deleted_at'         => $deleted ? now() : null,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);
    }

    #[Test]
    public function validator_reports_no_violations_for_the_reference_model(): void {
        $this->assertSame([], DataTableConfigValidator::validate(SalesOrder::class));
    }

    #[Test]
    public function reference_columns_expose_the_new_metadata(): void {
        $columns = $this->columns();

        $this->assertTrue($columns['code']['isLink']);
        $this->assertSame(['code', 'customer.name'], $columns['code']['dependsOn']);

        $this->assertSame('progress', $columns['billed_percent']['type']);
        $this->assertSame('expression', $columns['billed_percent']['searchVia']);
        $this->assertTrue($columns['billed_percent']['sortable']);
        $this->assertArrayNotHasKey('shape', $columns['billed_percent'], 'donut = default');
        $this->assertSame('bar', $columns['delivered_percent']['shape']);

        $this->assertTrue($columns['customer_summary']['virtual']);
        $this->assertSame('dependsOn', $columns['customer_summary']['searchVia']);
        $this->assertSame(['customer.name', 'customer_branch.name'], $columns['customer_summary']['dependsOn']);

        $this->assertSame('relations', $columns['items']['type']);
        $this->assertSame(3, $columns['items']['max'], 'opt-in eksplisit di SalesOrder');
        $this->assertSame('formStatuses', $columns['status']['type'], 'status existing tidak berubah');
    }

    #[Test]
    public function mobile_template_meta_is_cached_with_its_dependencies(): void {
        DataTableConfigCache::forget(SalesOrder::class);

        $meta = DataTableConfigCache::meta(SalesOrder::class);

        $this->assertSame(SalesOrder::mobileTemplate(), $meta['mobileTemplate']);
        $this->assertSame(['billed_percent', 'code', 'customer.name', 'date'], $meta['mobileDependsOn']);
    }

    #[Test]
    public function progress_expressions_compute_percentages_from_non_deleted_items(): void {
        $partial = $this->makeOrder('SO-PARTIAL');
        $this->addItem($partial, 10, 10, 5);
        $this->addItem($partial, 10, 0, 5);
        $this->addItem($partial, 999, 999, 999, deleted: true); // soft-delete diabaikan
        $this->makeOrder('SO-EMPTY');

        $columns = $this->columns();
        $query   = SalesOrder::query()->addSelect('sales_orders.code');
        foreach (['billed_percent', 'delivered_percent'] as $name) {
            $query->addSelect(DB::raw(ExpressionSql::forColumn($columns[$name]) . ' as ' . $name));
        }
        $rows = $query->orderBy('code')->get()->keyBy('code');

        $this->assertEquals(50, $rows['SO-PARTIAL']->billed_percent);
        $this->assertEquals(50, $rows['SO-PARTIAL']->delivered_percent);
        $this->assertNull($rows['SO-EMPTY']->billed_percent, 'tanpa item -> NULL ("-")');
    }

    #[Test]
    public function progress_column_is_filterable_and_virtual_summary_is_searchable(): void {
        $a = $this->makeOrder('SO-A', 'Maju Jaya');
        $this->addItem($a, 10, 10, 10);
        $b = $this->makeOrder('SO-B', 'Sentosa');
        $this->addItem($b, 10, 0, 0);

        $apply = function (array $item): array {
            $query = SalesOrder::query();
            (new FilterEvaluator(SalesOrder::getColumns(1)))->apply($query, ['root' => ['k' => 'and', 'c' => [$item]]]);

            return $query->orderBy('code')->pluck('code')->all();
        };

        $this->assertSame(['SO-A'], $apply(['k' => 'billed_percent', 'o' => '>=', 'v' => 100]));
        $this->assertSame(['SO-B'], $apply(['k' => 'delivered_percent', 'o' => '<', 'v' => 50]));
        $this->assertSame(['SO-A'], $apply(['k' => 'customer_summary', 'o' => 'matches', 'v' => 'maju']));
    }

    #[Test]
    public function index_page_serves_template_columns_expression_values_and_mobile_template(): void {
        DB::table('preferences')->insert([
            'key' => 'timezone', 'value' => json_encode('UTC'), 'is_example' => false, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $user   = User::factory()->create();
        $branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);
        $user->branches()->attach($branch->id);

        // Dokumen Submitable yang belum diajukan hanya tampak bagi pembuatnya.
        $order = $this->makeOrder('SO-INDEX', 'Indah Jaya', $user);
        $this->addItem($order, 4, 1, 2);

        $grant = [0 => [[
            'model'       => SalesOrder::class, 'level' => 0, 'only_creator' => false,
            'permissions' => ['select' => true, 'read' => true, 'write' => true, 'create' => true],
        ]]];

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->withSession(['permissions' => [SalesOrder::class => $grant], 'permissions_version' => '0|0|0|0', 'currentBranch' => $branch->id])
            ->get(route('salesOrders.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('mobileTemplate', SalesOrder::mobileTemplate())
                ->where('dataTableColumns', fn ($columns) => collect($columns)->every(fn ($column) => ! array_key_exists('expression', (array) $column))
                    && collect($columns)->contains(fn ($column) => ($column['name'] ?? null) === 'billed_percent'))
                ->where('data.data.0.code', 'SO-INDEX')
                ->where('data.data.0.billed_percent', fn ($value) => (float) $value === 50.0)
                ->where('data.data.0.delivered_percent', fn ($value) => (float) $value === 25.0)
                ->where('data.data.0.customer.name', 'Indah Jaya'));
    }

    #[Test]
    public function expression_never_leaks_through_print_and_other_column_metadata(): void {
        $tracked = app(RelationTrackerService::class)->validateRelations(SalesOrder::class, [], true)['modelColumns'];
        foreach ($tracked as $class => $columns) {
            foreach ($columns as $column) {
                $this->assertArrayNotHasKey('expression', $column, "{$class}::{$column['name']}");
            }
        }
        $this->assertTrue(collect($tracked[SalesOrder::class])->has('billed_percent'), 'kolom progress tetap ada tanpa key expression');

        $printColumns = (new PrintTemplate(['model' => SalesOrder::class, 'name_model' => 'SalesOrder']))->columns;
        $doc          = collect($printColumns)->firstWhere('type', 'doc');
        $this->assertNotNull($doc);
        foreach ($doc['columns'] as $column) {
            $this->assertArrayNotHasKey('expression', $column, $column['name']);
        }
    }
}

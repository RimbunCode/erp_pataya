<?php

namespace Tests\Feature\Finances;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Currency;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\SalesInvoice;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use Database\Factories\Finances\SalesInvoiceFactory;
use Database\Factories\Sales\SalesOrderFactory;
use Database\Seeders\AccountSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 14.2 (Requirement 12.8/13.8): kolom `accounts.is_contra` dihapus. Pemilihan akun, bagan akun
 * bawaan, dan default form invoice tidak boleh bergantung padanya; retur memakai aturan `variant=return`.
 */
class AccountIsContraRemovedTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutVite();
        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        // SQLite test tidak punya json_overlaps (fungsi MySQL) yang dipakai `SalesInvoiceController::create` untuk
        // mencari draft milik user; shim ini meniru irisan dua array JSON (pola PaymentEntryHttpTest).
        DB::connection()->getPdo()->sqliteCreateFunction('json_overlaps', function (?string $a, ?string $b): int {
            $left  = json_decode($a ?? '[]', true) ?? [];
            $right = json_decode($b ?? '[]', true) ?? [];

            return array_intersect($left, $right) !== [] ? 1 : 0;
        }, 2);

        Account::initPermissions();
        SalesInvoice::initPermissions();
        Currency::firstOrCreate(['code' => 'IDR'], ['name' => 'Indonesian rupiah']);
    }

    /**
     * Drift migrasi yang sudah dikenal (lihat OrderItemStoredColumnMigrationTest): `sales_orders` di SQLite uji tidak
     * punya kolom `code`/`created_by_id`/`status` yang diasumsikan `SalesOrderFactory`.
     */
    private function createSalesOrder(): SalesOrder {
        foreach (['code', 'created_by_id'] as $column) {
            if (! Schema::hasColumn('sales_orders', $column)) {
                Schema::table('sales_orders', fn ($table) => $table->string($column)->nullable());
            }
        }
        if (! Schema::hasColumn('sales_orders', 'status')) {
            Schema::table('sales_orders', fn ($table) => $table->json('status')->nullable());
        }

        return SalesOrderFactory::new()->create();
    }

    /**
     * @param  class-string  ...$models
     * @return array<string, mixed>
     */
    private function readPermissions(string ...$models): array {
        $permissions = [];
        foreach ($models as $model) {
            $permissions[$model] = [0 => [[
                'model'        => $model,
                'level'        => 0,
                'only_creator' => false,
                'permissions'  => ['select' => true, 'read' => true],
            ]]];
        }

        return [
            'permissions'         => $permissions,
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    /**
     * @return array<string, array<string, array{model: class-string, level: int, only_creator: bool, permissions: array<string, bool>}[]>>
     */
    private function createPermissions(): array {
        return [SalesInvoice::class => [[[
            'model'        => SalesInvoice::class,
            'level'        => 0,
            'only_creator' => false,
            'permissions'  => ['create' => true],
        ]]]];
    }

    #[Test]
    public function accounts_table_has_no_is_contra_column(): void {
        $this->assertFalse(Schema::hasColumn('accounts', 'is_contra'));
    }

    #[Test]
    public function drop_migration_is_reversible_and_idempotent(): void {
        $migration = require database_path('migrations/2026_11_22_100001_drop_is_contra_from_accounts_table.php');

        $migration->down();
        $this->assertTrue(Schema::hasColumn('accounts', 'is_contra'), 'down() menambah kembali kolom.');
        $migration->down();
        $this->assertTrue(Schema::hasColumn('accounts', 'is_contra'), 'down() kedua tidak gagal.');

        $migration->up();
        $this->assertFalse(Schema::hasColumn('accounts', 'is_contra'), 'up() menghapus kolom.');
        $migration->up();
        $this->assertFalse(Schema::hasColumn('accounts', 'is_contra'), 'up() kedua tidak gagal.');
    }

    #[Test]
    public function account_column_registry_and_casts_do_not_expose_is_contra(): void {
        $names = array_map(fn ($col) => $col['name'] ?? null, Account::getColumns());

        $this->assertNotContains('is_contra', $names);
        $this->assertContains('account_type', $names, 'Pemilih akun tetap memakai account_type.');
        $this->assertArrayNotHasKey('is_contra', (new Account)->getCasts());
    }

    #[Test]
    public function seeder_still_creates_former_contra_accounts_without_the_flag(): void {
        $this->seed(AccountSeeder::class);

        foreach (['1120', '4120', '4130'] as $number) {
            $account = Account::where('account_number', $number)->first();

            $this->assertNotNull($account, "Akun {$number} tetap dibuat seeder.");
            $this->assertArrayNotHasKey('is_contra', $account->getAttributes());
        }
    }

    #[Test]
    public function model_lookup_for_account_selection_works_by_account_type_after_the_drop(): void {
        $this->seed(AccountSeeder::class);

        $response = $this->actingAs(User::factory()->create())
            ->postJson(route('model'), [
                'model'   => Account::class,
                'filters' => [
                    'root_type'    => 'income',
                    'account_type' => 'income_account',
                    'is_group'     => false,
                ],
            ], ['X-Requested-With' => 'XMLHttpRequest']);

        $response->assertOk();
        $numbers = collect($response->json('data'))->pluck('account_number')->all();
        $this->assertContains('4110', $numbers);
        $this->assertContains('4120', $numbers, 'Akun bekas kontra tetap dapat dipilih lewat lookup /model tanpa filter flag.');
    }

    #[Test]
    public function account_index_and_general_ledger_pages_run_after_the_drop(): void {
        $this->seed(AccountSeeder::class);
        GeneralLedger::initPermissions();
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession($this->readPermissions(Account::class, GeneralLedger::class))
            ->get(route('accounts.index'))
            ->assertOk();
        $this->actingAs($user)
            ->withSession($this->readPermissions(Account::class, GeneralLedger::class))
            ->get(route('generalLedgers.index'))
            ->assertOk();
    }

    #[Test]
    public function sales_invoice_return_form_has_no_account_default(): void {
        $this->seed(AccountSeeder::class);

        $user    = User::factory()->create();
        $invoice = SalesInvoiceFactory::new()->create(['created_by_id' => $user->id]);

        $this->actingAs($user)
            ->withSession(['permissions' => $this->createPermissions()])
            ->get(route('salesInvoices.create', ['ref' => "salesInvoice/{$invoice->id}"]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaultData.is_return', true)
                ->missing('defaultData.income_account'));
    }

    #[Test]
    public function sales_invoice_create_form_works_for_normal_path_without_engine_mode_prop(): void {
        $this->seed(AccountSeeder::class);

        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['permissions' => $this->createPermissions()])
            ->get(route('salesInvoices.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->missing('accountsManagedByEngine'));
    }

    #[Test]
    public function sales_invoice_create_from_sales_order_has_no_account_defaults(): void {
        $this->seed(AccountSeeder::class);

        $user  = User::factory()->create();
        $order = $this->createSalesOrder();

        $this->actingAs($user)
            ->withSession(['permissions' => $this->createPermissions()])
            ->get(route('salesInvoices.create', ['ref' => "salesOrder/{$order->id}"]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->missing('defaultData.income_account')
                ->missing('defaultData.debit_account'));
    }

    private function dropMigration(): Migration {
        return require database_path('migrations/2026_11_22_100001_drop_is_contra_from_accounts_table.php');
    }

    #[Test]
    public function drop_migration_runs_without_depending_on_any_finance_setting(): void {
        $migration = $this->dropMigration();
        $migration->down();
        $this->assertTrue(Schema::hasColumn('accounts', 'is_contra'));

        // Tanpa mode posting (Q-P2-23): ada tidaknya baris setting Finances tidak memengaruhi migrasi.
        DB::table('finance_settings')->delete();
        $migration->up();
        $this->assertFalse(Schema::hasColumn('accounts', 'is_contra'), 'up() tanpa baris setting menghapus kolom.');

        $migration->down();
        DB::table('finance_settings')->insert([
            'id'         => (string) Str::ulid(),
            'singleton'  => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $migration->up();
        $this->assertFalse(Schema::hasColumn('accounts', 'is_contra'), 'up() dengan baris setting menghapus kolom.');
    }

    #[Test]
    public function drop_migration_down_restores_the_column_with_false_values(): void {
        $this->seed(AccountSeeder::class);
        $migration = $this->dropMigration();

        $migration->down();

        $this->assertTrue(Schema::hasColumn('accounts', 'is_contra'));
        $this->assertGreaterThan(0, DB::table('accounts')->count());
        $this->assertSame(0, DB::table('accounts')->where('is_contra', true)->count(), 'Nilai lama tidak dapat dipulihkan: semua baris false.');
        $this->assertSame(DB::table('accounts')->count(), DB::table('accounts')->where('is_contra', false)->count());
    }
}

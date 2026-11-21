<?php

namespace Tests\Feature\Finances;

use App\Enums\PostingDocumentType;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Currency;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\SalesInvoice;
use App\Models\User\User;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Posting\PostingModeResolver;
use Database\Factories\Finances\SalesInvoiceFactory;
use Database\Seeders\AccountSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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

    private function setSalesInvoiceMode(string $mode): void {
        $modes = array_merge(FinanceSetting::defaultAttributes()['posting_modes'], [PostingDocumentType::SalesInvoice->value => $mode]);
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_modes' => $modes]);
        PostingModeResolver::forget();
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
    public function account_selection_by_type_does_not_depend_on_the_flag(): void {
        $this->seed(AccountSeeder::class);

        $incomeNumbers = Account::where('root_type', 'income')
            ->where('account_type', 'income_account')
            ->pluck('account_number')
            ->all();

        $this->assertContains('4110', $incomeNumbers);
        $this->assertContains('4120', $incomeNumbers);
    }

    #[Test]
    public function sales_invoice_create_form_has_no_return_account_default_when_mode_is_not_on(): void {
        $this->seed(AccountSeeder::class);
        $this->setSalesInvoiceMode('off');

        $user    = User::factory()->create();
        $invoice = SalesInvoiceFactory::new()->create(['created_by_id' => $user->id]);

        $this->actingAs($user)
            ->withSession(['permissions' => $this->createPermissions()])
            ->get(route('salesInvoices.create', ['ref' => "salesInvoice/{$invoice->id}"]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaultData.is_return', true)
                ->where('defaultData.income_account', null));
    }

    #[Test]
    public function sales_invoice_create_form_still_works_for_normal_path_when_mode_is_not_on(): void {
        $this->seed(AccountSeeder::class);
        $this->setSalesInvoiceMode('off');

        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['permissions' => $this->createPermissions()])
            ->get(route('salesInvoices.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('accountsManagedByEngine', false));
    }
}

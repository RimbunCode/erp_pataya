<?php

namespace Tests\Feature\CRM;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Preference;
use App\Models\CRM\Quotation;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Sales\Customer;
use App\Models\User\User;
use Database\Factories\Core\BranchFactory;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Dasar test Quotation: menyiapkan user, cabang aktif, pelanggan, dan item, lalu
 * menyediakan payload yang lolos QuotationRequest. Middleware aplikasi dimatikan,
 * izin dikirim lewat session seperti test controller lain.
 */
abstract class QuotationTestCase extends TestCase {
    use RefreshDatabase {
        migrateDatabases as protected migrateDatabasesFromTrait;
    }

    protected User $user;
    protected Branch $branch;
    protected Customer $customer;
    protected ItemVariant $variant;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        // Skema tambahan (is_example, kolom DataTable) cukup disiapkan sekali, di luar
        // transaksi test. Kalau test lain sudah memigrasi lebih dulu, siapkan di sini.
        if (! Schema::hasColumn('quotations', 'is_example')) {
            $this->prepareQuotationSchema();
        }

        CountryFactory::new()->create(['code' => 'IDN']);
        Preference::create(['key' => 'timezone', 'value' => 'UTC']);

        $this->user     = User::factory()->create();
        $this->branch   = BranchFactory::new()->create(['code' => 'HQ']);
        $this->customer = CustomerFactory::new()->create();
        $this->variant  = ItemVariantFactory::new()->create();
    }

    /**
     * Migrasi sekali per proses test; langsung siapkan skema tambahan supaya tidak
     * diulang (dan dibatalkan rollback transaksi) di tiap test.
     */
    protected function migrateDatabases(): void {
        $this->migrateDatabasesFromTrait();

        $this->prepareQuotationSchema();
    }

    protected function prepareQuotationSchema(): void {
        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, Customer::class, Quotation::class] as $model) {
            $model::initPermissions();
        }
    }

    protected function tearDown(): void {
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }

        parent::tearDown();
    }

    /**
     * @return array<string, mixed>
     */
    protected function permissionSession(): array {
        return [
            'currentBranch' => $this->branch->id,
            'permissions'   => [
                Quotation::class => [
                    0 => [
                        [
                            'model'        => Quotation::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => true,
                                'create' => true,
                                'delete' => true,
                                'submit' => true,
                                'cancel' => true,
                                'amend'  => true,
                                'print'  => true,
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * Payload yang lolos QuotationRequest untuk jenis spare_part. Jenis lain
     * cukup menimpa `type` dan field yang diwajibkan jenis itu.
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    protected function payload(array $overrides = []): array {
        return [
            'type'         => 'spare_part',
            'attn'         => 'Ibu Desy',
            'introduction' => 'Berikut kami sampaikan penawarannya :',
            'date'         => '2026-09-22 03:00:00',
            'customer'     => ['id' => $this->customer->id],
            'items'        => [
                [
                    'id'       => 'new1',
                    'item'     => ['id' => $this->variant->id],
                    'quantity' => 2,
                    'price'    => 100,
                ],
            ],
            ...$overrides,
        ];
    }

    /**
     * Buat Quotation lewat endpoint store, seperti form yang sebenarnya.
     *
     * @param  array<string, mixed>  $overrides
     */
    protected function storeQuotation(array $overrides = []): Quotation {
        $this->actingAs($this->user)
            ->withSession($this->permissionSession())
            ->postJson(route('quotations.store'), $this->payload($overrides))
            ->assertRedirect();

        return Quotation::query()->latest('created_at')->latest('id')->firstOrFail();
    }

    protected function makeItemUnit(): ItemUnit {
        $unit = Unit::create([
            'code'              => 'PC',
            'name'              => 'Piece',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        return ItemUnit::create([
            'item_id'           => $this->variant->item_id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
    }
}

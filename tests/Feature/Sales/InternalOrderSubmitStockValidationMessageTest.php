<?php

namespace Tests\Feature\Sales;

use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Stock;
use App\Models\Sales\InternalOrder;
use App\Models\User\User;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Bug report user: submit Internal Order dengan stok kurang menghasilkan
 * pesan "Item  stock 1001, need 10359952.441344" -- nama item hilang
 * (ItemVariant tidak punya kolom `name`, yg ada `code`+`item_name`, tapi
 * InternalOrderService::submit() akses $item->item->name yg SELALU null)
 * dan dua angka tanpa satuan (padahal beda satuan dgn yg dipilih user di
 * baris dokumen -- ready_quantity & quantity hasil konversi memakai satuan
 * $stock, bukan satuan $item yg dipilih user).
 *
 * Fix ada di app/Services/Sales/InternalOrderService.php::submit(): pesan
 * sekarang memuat "{code} - {item_name}" utk identitas item, serta nama
 * satuan ($stock->unit->name utk ready_quantity & quantity hasil konversi,
 * $item->unit->name utk qty asli yg diinput user) supaya angka bisa
 * dibandingkan apple-to-apple oleh user.
 */
class InternalOrderSubmitStockValidationMessageTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Branch $branch;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, InternalOrder::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user   = User::factory()->create();
        $this->branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);
    }

    private function sessionWithInternalOrderPermissions(): array {
        return [
            'permissions' => [
                InternalOrder::class => [
                    0 => [[
                        'model'        => InternalOrder::class,
                        'level'        => 0,
                        'only_creator' => false,
                        'permissions'  => [
                            'select' => true,
                            'read'   => true,
                            'write'  => true,
                            'create' => true,
                            'submit' => true,
                        ],
                    ]],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => $this->branch->id,
        ];
    }

    /**
     * Insert unit master (`units`) + pivot (`item_units`) utk sebuah item,
     * meniru pola InternalOrderSourceWarehouseTest::makeItemUnit() tapi
     * dengan nama & conversion_factor custom supaya bisa membuat skenario
     * "satuan baris beda dgn satuan stok" seperti bug report asli.
     */
    private function makeItemUnit(string $itemId, string $unitName, float $conversionFactor): string {
        $unitMasterId = (string) Str::ulid();
        DB::table('units')->insert([
            'id'                => $unitMasterId,
            'code'              => Str::upper(Str::random(6)),
            'name'              => $unitName,
            'conversion_factor' => $conversionFactor,
            'is_default'        => $conversionFactor === 1.0,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $itemUnitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'                => $itemUnitId,
            'item_id'           => $itemId,
            'unit_id'           => $unitMasterId,
            'conversion_factor' => $conversionFactor,
            'is_default'        => $conversionFactor === 1.0,
            'order'             => 0,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return $itemUnitId;
    }

    public function test_submit_error_message_includes_item_identity_and_units_when_stock_is_insufficient(): void {
        $itemVariant = ItemVariantFactory::new()->create();
        $warehouse   = WarehouseFactory::new()->create();

        // Satuan baris dokumen yg dipilih user: 1 Box = 12 Pcs.
        $boxUnitId = $this->makeItemUnit($itemVariant->item_id, 'Box', 12);
        // Satuan stok gudang: Pcs (base unit, factor 1) -- SENGAJA beda dgn
        // satuan baris, persis seperti bug report (Square Mile vs m²).
        $pcsUnitId = $this->makeItemUnit($itemVariant->item_id, 'Pcs', 1);

        // Stok tersedia cuma 10 Pcs, padahal kebutuhan = 5 Box * 12 = 60 Pcs.
        Stock::create([
            'item_variant_id'   => $itemVariant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $pcsUnitId,
            'quantity'          => 10,
            'conversion_factor' => 1,
            'stock_queue'       => [],
        ]);

        $this
            ->actingAs($this->user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithInternalOrderPermissions())
            ->post('/internalOrders', [
                'date'  => now()->toDateString(),
                'items' => [
                    [
                        'id'               => (string) Str::ulid(),
                        'item'             => ['id' => $itemVariant->id],
                        'unit'             => ['id' => $boxUnitId],
                        'quantity'         => 5,
                        'source_warehouse' => ['id' => $warehouse->id],
                    ],
                ],
            ])
            ->assertSessionHasNoErrors();

        $internalOrder = InternalOrder::firstOrFail();

        $response = $this
            ->actingAs($this->user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithInternalOrderPermissions())
            ->put("/internalOrders/{$internalOrder->id}/submit");

        $response->assertSessionHasErrors('items');

        /** @var array<int, string> $messages */
        $messages = session('errors')->get('items');
        $this->assertCount(1, $messages);
        $message = $messages[0];

        $itemVariant->refresh();
        $this->assertStringContainsString(
            $itemVariant->code,
            $message,
            'Pesan harus memuat kode item (ItemVariant::code).',
        );
        $this->assertStringContainsString(
            $itemVariant->item_name,
            $message,
            'Pesan harus memuat nama item (ItemVariant::item_name) -- ItemVariant TIDAK punya kolom `name`.',
        );
        $this->assertStringContainsString(
            '10',
            $message,
            'Pesan harus memuat stok tersedia (ready_quantity).',
        );
        $this->assertStringContainsString(
            '60',
            $message,
            'Pesan harus memuat kebutuhan (quantity) hasil konversi dlm satuan stok.',
        );
        $this->assertStringContainsString(
            'Pcs',
            $message,
            'Pesan harus memuat nama satuan stok (Pcs) supaya kedua angka apple-to-apple.',
        );
        $this->assertStringContainsString(
            'Box',
            $message,
            'Pesan harus memuat nama satuan asli yg dipilih user di baris dokumen (Box).',
        );
        $this->assertStringContainsString(
            '5',
            $message,
            'Pesan harus memuat qty asli yg diinput user (5 Box) sbg asal-usul angka kebutuhan.',
        );
    }
}

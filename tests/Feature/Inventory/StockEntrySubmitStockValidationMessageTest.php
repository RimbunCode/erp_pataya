<?php

namespace Tests\Feature\Inventory;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\User\User;
use App\Services\Inventory\StockEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Bug yang sama dengan InternalOrderSubmitStockValidationMessageTest dan
 * SalesOrderService::submit(): StockEntryService::submit() (item_issue/
 * item_transfer/item_consumption) mengakses $item->item->name padahal
 * ItemVariant tidak punya kolom `name` (yang ada `code` + `item_name`),
 * sehingga nama item selalu hilang dari pesan. Angka stok vs kebutuhan
 * juga ditampilkan tanpa satuan, padahal keduanya dalam satuan baris stok
 * (hasil konversi), bukan satuan yang dipilih user di baris dokumen.
 *
 * Fix ada di app/Services/Inventory/StockEntryService.php::submit(): pesan
 * sekarang memuat "{code} - {item_name}" untuk identitas item, serta nama
 * satuan ($stock->unit->name untuk ready_quantity & quantity hasil konversi,
 * $item->unit->name untuk qty asli yang diinput user).
 *
 * Test dipanggil langsung ke Service (bukan lewat HTTP) meniru pola
 * StockEntrySubmitTest::test_submit_item_issue_does_not_throw_relation_not_found_exception
 * -- setup paling ringan karena tidak perlu permission/session HTTP, dan
 * jalur item_issue melempar ValidationException sebelum sampai ke
 * checkApproval() sehingga tidak perlu setup Account/ApprovalScheme.
 */
class StockEntrySubmitStockValidationMessageTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach ([User::class, FormatingSeries::class, Branch::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockEntry::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeUser(): User {
        $id = (string) str()->ulid();
        DB::table('users')->insert([
            'id'         => $id,
            'name'       => 'Tester',
            'email'      => $id . '@test.com',
            'password'   => null,
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::find($id);
    }

    public function test_submit_error_message_includes_item_identity_and_units_when_stock_is_insufficient(): void {
        $branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB']);

        $warehouse = Warehouse::create([
            'branch_id' => $branch->id,
            'name'      => 'Warehouse 1',
            'code'      => 'WH-1',
        ]);

        // Satuan stok gudang: Pcs (base unit, factor 1).
        $pcsUnit = Unit::create(['code' => 'PCS', 'name' => 'Pcs']);
        // Satuan baris dokumen yang dipilih user: 1 Box = 12 Pcs -- SENGAJA
        // beda dgn satuan stok, persis skenario bug report asli.
        $boxUnit = Unit::create(['code' => 'BOX', 'name' => 'Box']);

        $item = Item::create([
            'code'            => 'ITEM-1',
            'name'            => 'Item 1',
            'default_unit_id' => $pcsUnit->id,
            'type'            => 'inventory',
        ]);

        $itemVariant = ItemVariant::create([
            'item_id'   => $item->id,
            'code'      => 'ITEM-1-VAR',
            'item_code' => 'ITEM-1',
            'item_name' => 'Item 1',
            'type'      => 'inventory',
        ]);

        $pcsItemUnit = ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $pcsUnit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        $boxItemUnit = ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $boxUnit->id,
            'conversion_factor' => 12,
            'is_default'        => false,
        ]);

        // Stok tersedia cuma 10 Pcs, padahal kebutuhan = 5 Box * 12 = 60 Pcs.
        Stock::create([
            'item_variant_id'   => $itemVariant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $pcsItemUnit->id,
            'quantity'          => 10,
            'conversion_factor' => 1,
            'stock_queue'       => [],
        ]);

        Auth::login($this->makeUser());

        $stockEntry = StockEntry::create([
            'code'      => 'SE-DRAFT-1',
            'date'      => now(),
            'type'      => 'item_issue',
            'status'    => [FormStatus::DRAFT],
            'branch_id' => $branch->id,
        ]);

        $stockEntry->items()->create([
            'item_id'             => $itemVariant->id,
            'source_warehouse_id' => $warehouse->id,
            'quantity'            => 5,
            'item_unit_id'        => $boxItemUnit->id,
            'conversion_factor'   => 12,
            'basic_rate'          => 1000,
        ]);

        $service = app(StockEntryService::class);

        try {
            $service->submit($stockEntry->fresh());
            $this->fail('Expected ValidationException was not thrown (stock sengaja kurang).');
        } catch (ValidationException $e) {
            $messages = collect($e->errors()['items'] ?? []);
            $this->assertCount(1, $messages);
            $message = $messages->first();

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
                'Pesan harus memuat nama satuan asli yang dipilih user di baris dokumen (Box).',
            );
            $this->assertStringContainsString(
                '5',
                $message,
                'Pesan harus memuat qty asli yang diinput user (5 Box) sbg asal-usul angka kebutuhan.',
            );
        }
    }
}

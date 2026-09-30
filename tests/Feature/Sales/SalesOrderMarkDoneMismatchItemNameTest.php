<?php

namespace Tests\Feature\Sales;

use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Sales\SalesOrderService;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Bug yang sama dengan InternalOrderSubmitStockValidationMessageTest dan
 * StockEntrySubmitStockValidationMessageTest: SalesOrderService::markDone()
 * (baris ~531 sebelum fix) mengisi 'item_name' payload mismatches dengan
 * $soItem->item?->name -- padahal ItemVariant tidak punya kolom `name`
 * (yang ada `code` + `item_name`), sehingga nama item SELALU null. Frontend
 * (resources/js/Pages/Sales/SalesOrders/Show.jsx baris ~378) merender
 * <strong>{m.item_name}</strong> di dialog konfirmasi Mark Done -- akibatnya
 * dialog menampilkan nama item kosong.
 *
 * sales_order_items TIDAK punya kolom snapshot `item_name` (beda dengan
 * purchase_order_items->item_name yang dipakai PurchaseOrderService::markDone()),
 * jadi fix memakai pola $itemLabel ("{code} - {item_name}") yang sama dengan
 * SalesOrderService::submit() di file yang sama, bukan kolom snapshot.
 *
 * Skenario: satu SalesOrderItem sudah delivered (5) lewat DeliveryNoteItem
 * tapi belum ada SalesInvoiceItem sama sekali (billed = 0) -- delivered !=
 * billed memicu mismatch, markDone() melempar ValidationException sebelum
 * menyentuh syncItems()/status, jadi tidak perlu setup SalesInvoice/ApprovalScheme.
 */
class SalesOrderMarkDoneMismatchItemNameTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach ([User::class, FormatingSeries::class, SalesOrder::class, DeliveryNote::class] as $model) {
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

    public function test_mark_done_mismatch_payload_includes_item_identity_instead_of_null_name(): void {
        Auth::login($this->makeUser());

        $itemVariant = ItemVariantFactory::new()->create();

        $salesOrder = SalesOrder::create([
            'code' => 'SO-MD-TEST-1',
            'date' => now(),
        ]);

        $soItem = $salesOrder->items()->create([
            'item_id'  => $itemVariant->id,
            'quantity' => 5,
            'price'    => 0,
        ]);

        // Delivery note "pengangkut" -- referenceable-nya diarahkan langsung
        // ke SalesOrder yg diuji (bukan bikin SalesOrder terpisah spt
        // DeliveryNoteFactory bawaan), supaya setup tetap minimal.
        $permission = Permission::create([
            'module' => 'inventory',
            'name'   => 'delivery_note_mark_done_test',
            'model'  => DeliveryNote::class,
        ]);

        $deliveryNote = DeliveryNote::create([
            'code'               => 'DN-MD-TEST-1',
            'delivery_date'      => now(),
            'reference_to_id'    => $permission->id,
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $salesOrder->id,
        ]);

        DeliveryNoteItem::create([
            'delivery_note_id'   => $deliveryNote->id,
            'item_id'            => $itemVariant->id,
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 5,
            'valuation_rates'    => [],
        ]);

        // Hubungkan DeliveryNote ke SalesOrder lewat ModelConnection -- ini yg
        // dibaca markDone() utk menghitung deliveredQty (bukan referenceable
        // langsung), meniru SalesOrderService::syncItems()/markDone().
        ModelConnection::create([
            'model_type'     => SalesOrder::class,
            'model_id'       => $salesOrder->id,
            'reference_type' => DeliveryNote::class,
            'reference_id'   => $deliveryNote->id,
        ]);

        // Sengaja TIDAK ada SalesInvoiceItem sama sekali -> billedQty = 0,
        // deliveredQty = 5 -> mismatch.
        $service = app(SalesOrderService::class);

        try {
            $service->markDone($salesOrder->fresh());
            $this->fail('Expected ValidationException was not thrown (delivered != billed sengaja dibuat mismatch).');
        } catch (ValidationException $e) {
            $mismatches = $e->errors()['mismatches'] ?? [];
            $this->assertCount(1, $mismatches);
            $mismatch = $mismatches[0];

            $this->assertIsString($mismatch['item_name'] ?? null);
            $this->assertNotSame(
                '',
                trim((string) ($mismatch['item_name'] ?? '')),
                'item_name tidak boleh kosong -- ItemVariant tidak punya kolom `name`.',
            );
            $this->assertStringContainsString(
                $itemVariant->code,
                $mismatch['item_name'],
                'item_name harus memuat kode item (ItemVariant::code).',
            );
            $this->assertStringContainsString(
                $itemVariant->item_name,
                $mismatch['item_name'],
                'item_name harus memuat nama item (ItemVariant::item_name).',
            );
            $this->assertEquals(5, $mismatch['delivered_qty']);
            $this->assertEquals(0, $mismatch['billed_qty']);
        }
    }
}

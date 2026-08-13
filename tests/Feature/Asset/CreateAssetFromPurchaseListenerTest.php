<?php

namespace Tests\Feature\Asset;

use App\Events\Asset\FixedAssetItemApproved;
use App\Listeners\Asset\CreateAssetFromPurchase;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Asset\AssetService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Listener CreateAssetFromPurchase diuji langsung via handle() (bukan lewat
 * onApproved() penuh) — logic bisnis Requirement 3/4 adalah tanggung jawab
 * listener, onApproved() cuma titik dispatch (dicover test dispatch terpisah
 * di PurchaseReceiptServiceFixedAssetDispatchTest / PurchaseInvoiceService setara).
 * Pola pengujian service via panggilan langsung sudah dipakai AssetApprovalFlowTest.
 */
class CreateAssetFromPurchaseListenerTest extends TestCase {
    use RefreshDatabase;

    private CreateAssetFromPurchase $listener;
    private User $testUser;

    protected function setUp(): void {
        parent::setUp();
        $this->listener = new CreateAssetFromPurchase(new AssetService);

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // initPermissions() menambah kolom runtime (status, code, dst) yang di
        // produksi dibuat oleh PermissionSeeder, bukan migration — dibutuhkan
        // semua model Submitable/DataTable yang dipakai di rantai setup test ini.
        foreach ([
            FormatingSeries::class,
            Supplier::class,
            PurchaseOrder::class,
            PurchaseReceipt::class,
            PurchaseInvoice::class,
            Asset::class,
        ] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        CountryFactory::new()->create(['code' => 'IDN']);
        $this->testUser = User::factory()->create();

        // TIDAK actingAs() secara default — DataTable::created hook (boot
        // trait, dijalankan UNCONDITIONAL saat Auth::id() truthy, bukan lewat
        // event listener) memanggil $model->loadRelations() + $model->toArray()
        // pada model apapun yang punya relasi ke Supplier. loadRelations() tidak
        // nested-load 'supplier.country', jadi accessor
        // Supplier::getAddressAttribute() crash saat toArray() memicu $appends
        // pada instance Supplier yang relasi country-nya belum ter-load. Ini
        // bug pre-existing pada model Supplier + sistem audit generik, di luar
        // scope Spec 2 — dihindari dengan TIDAK login Auth saat membuat data
        // pendukung (Supplier/PurchaseOrder/dst), baru login saat memanggil
        // listener yang benar-benar diuji (butuh created_by_id terisi).
    }

    private function makeFixedAssetItem(): Item {
        return ItemFactory::new()->create(['is_fixed_asset' => true]);
    }

    /**
     * DataTable::created hook (boot trait) memanggil $model->loadRelations() +
     * toArray() UNCONDITIONAL saat Auth aktif — utk PurchaseOrder ini me-load
     * relasi 'supplier' TANPA nested 'supplier.country', dan entah lewat jalur
     * apa proses itu membuat accessor Supplier::getAddressAttribute() crash
     * (country null) meski country_id valid di DB. Bug pre-existing di luar
     * scope Spec 2 (Supplier + sistem audit generik) — dihindari dengan
     * withoutEvents() saat membuat data pendukung transaksi Purchase.
     */
    private function withoutModelEvents(callable $callback) {
        return BaseModel::withoutEvents($callback);
    }

    private function makePurchaseOrderItem(Item $item, float $rate, float $quantity): PurchaseOrderItem {
        $variant  = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $supplier = SupplierFactory::new()->create();

        $this->actingAs($this->testUser);
        $po = $this->withoutModelEvents(fn () => PurchaseOrderFactory::new()->create(['supplier_id' => $supplier->id]));

        return PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'item_id'           => $variant->id,
            'quantity'          => $quantity,
            'rate'              => $rate,
        ]);
    }

    private function makeReceiptItem(PurchaseOrderItem $poItem, float $quantity): PurchaseReceiptItem {
        $receipt = $this->withoutModelEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $poItem->purchase_order_id,
            'created_by_id'     => $this->testUser->id,
        ]));

        return PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $poItem->id,
            'item_id'                => $poItem->item_id,
            'quantity'               => $quantity,
        ]);
    }

    private function makeInvoiceItem(PurchaseOrderItem $poItem, float $quantity, float $rate): PurchaseInvoiceItem {
        $invoice = $this->withoutModelEvents(fn () => PurchaseInvoice::create([
            'code'              => 'PI-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $poItem->purchase_order_id,
            'created_by_id'     => $this->testUser->id,
        ]));

        return PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $poItem->id,
            'item_id'                => $poItem->item_id,
            'quantity'               => $quantity,
            'rate'                   => $rate,
        ]);
    }

    #[Test]
    public function creates_asset_from_receipt_with_correct_amount_mapping(): void {
        $item        = $this->makeFixedAssetItem();
        $poItem      = $this->makePurchaseOrderItem($item, rate: 5_000_000, quantity: 2);
        $receiptItem = $this->makeReceiptItem($poItem, quantity: 2);

        $event = new FixedAssetItemApproved($receiptItem->purchaseReceipt, $receiptItem, $item);
        $this->listener->handle($event);

        $asset = Asset::where('purchase_receipt_item_id', $receiptItem->id)->first();

        $this->assertNotNull($asset, 'Asset harus terbuat dari PurchaseReceiptItem fixed-asset.');
        $this->assertEquals($item->name, $asset->asset_name);
        $this->assertNull($asset->asset_category_id);
        $this->assertNull($asset->asset_location_id);
        $this->assertEquals(2, $asset->asset_quantity);
        $this->assertEquals($receiptItem->purchase_receipt_id, $asset->purchase_receipt_id);

        // Bug fix: amount HARUS rate x quantity, bukan 0 (bug produksi
        // ditemukan+diperbaiki: kode lama kalikan quantity dengan literal 0).
        $this->assertEquals(10_000_000, $asset->gross_purchase_amount);
        $this->assertEquals(10_000_000, $asset->net_purchase_amount);
    }

    #[Test]
    public function creates_asset_with_category_from_item_when_present(): void {
        $category = AssetCategory::factory()->create();
        $item     = ItemFactory::new()->create([
            'is_fixed_asset'    => true,
            'asset_category_id' => $category->id,
        ]);
        $poItem      = $this->makePurchaseOrderItem($item, rate: 1000, quantity: 1);
        $receiptItem = $this->makeReceiptItem($poItem, quantity: 1);

        $this->listener->handle(new FixedAssetItemApproved($receiptItem->purchaseReceipt, $receiptItem, $item));

        $asset = Asset::where('purchase_receipt_item_id', $receiptItem->id)->first();

        $this->assertEquals($category->id, $asset->asset_category_id);
    }

    #[Test]
    public function does_not_create_duplicate_asset_when_handled_twice(): void {
        $item        = $this->makeFixedAssetItem();
        $poItem      = $this->makePurchaseOrderItem($item, rate: 1000, quantity: 1);
        $receiptItem = $this->makeReceiptItem($poItem, quantity: 1);
        $event       = new FixedAssetItemApproved($receiptItem->purchaseReceipt, $receiptItem, $item);

        $this->listener->handle($event);
        $this->listener->handle($event);

        $this->assertEquals(
            1,
            Asset::where('purchase_receipt_item_id', $receiptItem->id)->count(),
            'Memicu handle() dua kali untuk baris yang sama tidak boleh menghasilkan Asset ganda.',
        );
    }

    #[Test]
    public function invoice_syncs_existing_asset_from_matching_receipt_instead_of_creating_new(): void {
        $item        = $this->makeFixedAssetItem();
        $poItem      = $this->makePurchaseOrderItem($item, rate: 1000, quantity: 3);
        $receiptItem = $this->makeReceiptItem($poItem, quantity: 3);

        $this->listener->handle(new FixedAssetItemApproved($receiptItem->purchaseReceipt, $receiptItem, $item));
        $existingAsset = Asset::where('purchase_receipt_item_id', $receiptItem->id)->first();

        $invoiceItem = $this->makeInvoiceItem($poItem, quantity: 3, rate: 1200);
        $this->listener->handle(new FixedAssetItemApproved($invoiceItem->purchaseInvoice, $invoiceItem, $item));

        $this->assertEquals(1, Asset::count(), 'Invoice untuk PO yang sama tidak boleh membuat Asset baru.');

        $existingAsset->refresh();
        $this->assertEquals($invoiceItem->purchase_invoice_id, $existingAsset->purchase_invoice_id);
        $this->assertEquals($invoiceItem->id, $existingAsset->purchase_invoice_item_id);
        $this->assertEquals($invoiceItem->amount, $existingAsset->gross_purchase_amount);
    }

    #[Test]
    public function invoice_creates_new_asset_when_no_matching_receipt_exists(): void {
        $item        = $this->makeFixedAssetItem();
        $poItem      = $this->makePurchaseOrderItem($item, rate: 1000, quantity: 1);
        $invoiceItem = $this->makeInvoiceItem($poItem, quantity: 1, rate: 1000);

        $this->listener->handle(new FixedAssetItemApproved($invoiceItem->purchaseInvoice, $invoiceItem, $item));

        $asset = Asset::where('purchase_invoice_item_id', $invoiceItem->id)->first();

        $this->assertNotNull($asset, 'Invoice tanpa Receipt terkait harus membuat Asset baru.');
        $this->assertEquals($invoiceItem->purchase_invoice_id, $asset->purchase_invoice_id);
        $this->assertNull($asset->purchase_receipt_id);
    }

    #[Test]
    public function invoice_creates_separate_asset_when_related_receipt_already_closed_by_another_invoice(): void {
        $item        = $this->makeFixedAssetItem();
        $poItem      = $this->makePurchaseOrderItem($item, rate: 1000, quantity: 2);
        $receiptItem = $this->makeReceiptItem($poItem, quantity: 2);

        $this->listener->handle(new FixedAssetItemApproved($receiptItem->purchaseReceipt, $receiptItem, $item));

        $firstInvoiceItem = $this->makeInvoiceItem($poItem, quantity: 2, rate: 1000);
        $this->listener->handle(new FixedAssetItemApproved($firstInvoiceItem->purchaseInvoice, $firstInvoiceItem, $item));

        // Asset dari Receipt sekarang sudah punya purchase_invoice_id (closed).
        $this->assertEquals(1, Asset::count());

        // Invoice KEDUA untuk PO item yang sama (mis. invoice susulan/koreksi) —
        // tidak boleh menimpa Asset yang sudah closed oleh invoice pertama.
        $secondInvoiceItem = $this->makeInvoiceItem($poItem, quantity: 2, rate: 1000);
        $this->listener->handle(new FixedAssetItemApproved($secondInvoiceItem->purchaseInvoice, $secondInvoiceItem, $item));

        $this->assertEquals(
            2,
            Asset::count(),
            'Invoice kedua untuk Receipt yang sudah closed harus membuat Asset baru, bukan menimpa yang lama.',
        );
    }
}

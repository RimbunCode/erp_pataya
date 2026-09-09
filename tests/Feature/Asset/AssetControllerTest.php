<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class AssetControllerTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        // initPermissions() bukan cuma soal permission -- ia juga
        // runtime-patch kolom shared trait (Submitable: status/code/
        // branch_id/dst; TreeView: parent_id/lft/rgt/depth) via
        // Schema::hasColumn() check (lihat DataTable::initPermissions()).
        // Semua model submitable/tree yang dipakai helper test ini (termasuk
        // PurchaseOrder/PurchaseReceipt/PurchaseInvoice/Supplier untuk
        // consistency test PO) WAJIB disertakan di sini, atau create()-nya
        // gagal "no column named ..." tergantung urutan/isolasi test run.
        foreach ([
            FormatingSeries::class, Asset::class,
            Supplier::class,
            PurchaseOrder::class, PurchaseReceipt::class, PurchaseInvoice::class,
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
    }

    /**
     * AssetService::create()/update() memakai DB::beginTransaction() manual TANPA
     * try/catch + rollback (bug produksi terpisah — lihat catatan di
     * test_store_fails_due_to_missing_code_on_create). Ketika exception terjadi
     * di dalam transaksi itu, transaksi tertinggal terbuka dan merusak test
     * berikutnya ("cannot start a transaction within a transaction"). Rollback
     * paksa di sini murni test hygiene — TIDAK menutupi bug produksinya, yang
     * tetap perlu diperbaiki di AssetService itu sendiri.
     */
    protected function tearDown(): void {
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }

        parent::tearDown();
    }

    private function permissions(): array {
        return [
            'permissions' => [
                Asset::class => [
                    0 => [
                        [
                            'model'        => Asset::class,
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
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * [FIXED] Sebelumnya AssetService::create() tidak pernah mengisi `code`
     * (kolom NOT NULL) — cuma diisi di submit(). Sekarang create() memanggil
     * FormatingSeries::generate(Asset::class, $data, true) untuk kode DRAFT
     * (isDraft=true, nomor urut terpisah dari kode final submit), sesuai
     * keputusan desain: kode draft di create(), kode final di submit().
     */
    public function test_store_creates_asset_with_draft_code(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'            => 'Toyota Avanza B 1234 XYZ',
                'asset_category'        => ['id' => $category->id],
                'asset_location'        => ['id' => $location->id],
                'asset_quantity'        => 1,
                'ownership_type'        => 'company',
                'ownership_company_id'  => (string) Str::ulid(),
                'gross_purchase_amount' => 250_000_000,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('assets', [
            'asset_name' => 'Toyota Avanza B 1234 XYZ',
        ]);

        $asset = Asset::where('asset_name', 'Toyota Avanza B 1234 XYZ')->firstOrFail();
        $this->assertNotEmpty($asset->code);
    }

    public function test_store_requires_asset_name_and_category_and_location(): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['asset_name', 'asset_category.id', 'asset_location.id']);
    }

    public function test_update_modifies_existing_asset(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create(['asset_name' => 'Lama']);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->putJson(route('assets.update', $asset), [
                'asset_name'     => 'Baru',
                'asset_category' => ['id' => $asset->asset_category_id],
                'asset_location' => ['id' => $asset->asset_location_id],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('assets', [
            'id'         => $asset->id,
            'asset_name' => 'Baru',
        ]);
    }

    /**
     * [FIXED] AssetRequest sekarang memvalidasi ownership exclusivity
     * (Requirement 4.3-4.5) via withValidator() — ownership_type=supplier tanpa
     * ownership_supplier_id sekarang ditolak HTTP 422, bukan lolos ke model.
     */
    public function test_ownership_exclusivity_rejected_at_request_level(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->putJson(route('assets.update', $asset), [
                'asset_name'     => $asset->asset_name,
                'asset_category' => ['id' => $asset->asset_category_id],
                'asset_location' => ['id' => $asset->asset_location_id],
                'ownership_type' => 'supplier',
                // ownership_supplier_id sengaja TIDAK diisi
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ownership_supplier_id']);
    }

    /**
     * [FIXED] ownership_type=company tidak boleh mewajibkan ownership_company_id
     * — tidak ada model Company (app single-tenant) dan Form.jsx tidak pernah
     * mengirim field ini untuk tipe company, beda dengan supplier/customer yang
     * memang punya entitas untuk dipilih.
     */
    public function test_ownership_type_company_does_not_require_company_id(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->putJson(route('assets.update', $asset), [
                'asset_name'     => $asset->asset_name,
                'asset_category' => ['id' => $asset->asset_category_id],
                'asset_location' => ['id' => $asset->asset_location_id],
                'ownership_type' => 'company',
                // ownership_company_id sengaja TIDAK diisi — tidak wajib
            ])
            ->assertRedirect();
    }

    /**
     * [FIXED] AssetRequest memvalidasi asset_quantity>1 lewat withValidator()
     * — ditolak HTTP 422 rapi kalau allow_bulk_quantity tidak dikirim true
     * (Spec asset-category-simplification: field milik Asset sendiri, bukan
     * lagi AssetCategory), bukan LogicException dari model hook.
     */
    public function test_rentable_quantity_rejected_at_request_level(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'     => 'Excavator Banyak',
                'asset_category' => ['id' => $category->id],
                'asset_location' => ['id' => $location->id],
                'asset_quantity' => 5,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['asset_quantity']);
    }

    /**
     * Spec asset-category-simplification, Requirement 2.2/4.2/4.3:
     * allow_bulk_quantity kini milik Asset sendiri, independen dari kategori.
     */
    public function test_allow_bulk_quantity_true_accepts_quantity_greater_than_one(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'          => 'Excavator Banyak',
                'asset_category'      => ['id' => $category->id],
                'asset_location'      => ['id' => $location->id],
                'asset_quantity'      => 5,
                'allow_bulk_quantity' => true,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('assets', [
            'asset_name'          => 'Excavator Banyak',
            'allow_bulk_quantity' => true,
        ]);
    }

    // ─── Spec asset-management-purchase-integration-v2 ─────────────────────

    private function makeFixedAssetItem(): array {
        $item    = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $variant = ItemVariantFactory::new()->create(['item_id' => $item->id]);

        return [$item, $variant];
    }

    private function makePurchaseOrderItem(ItemVariant $variant, float $quantity = 1, float $rate = 1000): PurchaseOrderItem {
        // PurchaseOrder::create() manual (BUKAN PurchaseOrderFactory) --
        // PurchaseOrderFactory::definition() eager-execute
        // SupplierFactory::new()->create() di dalam array literal, jadi
        // override supplier_id=>null di create([...]) TIDAK mencegah side
        // effect itu (SupplierFactory dipanggil DULUAN sebelum override
        // diterapkan). Test ini tidak butuh Supplier sama sekali
        // (supplier_id nullable), jadi manual create lebih simpel.
        $user = User::factory()->create();
        $po   = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-' . fake()->unique()->randomNumber(8),
            'date'          => now(),
            'supplier_id'   => null,
            'created_by_id' => $user->id,
            'status'        => [FormStatus::SUBMITTED],
        ]));

        return PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'item_id'           => $variant->id,
            'quantity'          => $quantity,
            'rate'              => $rate,
        ]);
    }

    private function makeReceiptItem(ItemVariant $variant, ?PurchaseOrderItem $poItem = null, float $quantity = 1): PurchaseReceiptItem {
        $user    = User::factory()->create();
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'          => 'PR-' . fake()->unique()->randomNumber(8),
            'date'          => now(),
            'created_by_id' => $user->id,
        ]));

        return PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $poItem?->id,
            'item_id'                => $variant->id,
            'quantity'               => $quantity,
        ]);
    }

    private function makeInvoiceItem(ItemVariant $variant, ?PurchaseOrderItem $poItem = null, float $quantity = 1, float $rate = 1000): PurchaseInvoiceItem {
        $user    = User::factory()->create();
        $invoice = BaseModel::withoutEvents(fn () => PurchaseInvoice::create([
            'code'          => 'PI-' . fake()->unique()->randomNumber(8),
            'date'          => now(),
            'created_by_id' => $user->id,
        ]));

        $invoiceItem = PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $poItem?->id,
            'item_id'                => $variant->id,
            'quantity'               => $quantity,
            'rate'                   => $rate,
        ]);

        // basic_amount/amount adalah generated column (quantity * rate) --
        // refresh supaya instance PHP tidak stale (Eloquent tidak otomatis
        // membaca ulang generated column setelah create()).
        return $invoiceItem->refresh();
    }

    public function test_item_id_must_be_fixed_asset(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $item     = ItemFactory::new()->create(['is_fixed_asset' => false]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'     => 'Non Fixed Asset Item',
                'asset_category' => ['id' => $category->id],
                'asset_location' => ['id' => $location->id],
                'item_id'        => $item->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['item_id']);
    }

    public function test_purchase_receipt_item_already_converted_rejected(): void {
        $user             = User::factory()->create();
        $category         = AssetCategory::factory()->create();
        $location         = AssetLocation::factory()->create();
        [$item, $variant] = $this->makeFixedAssetItem();
        $receiptItem      = $this->makeReceiptItem($variant);

        Asset::factory()->create([
            'item_id'                  => $item->id,
            'asset_category_id'        => $category->id,
            'asset_location_id'        => $location->id,
            'purchase_receipt_item_id' => $receiptItem->id,
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'               => 'Sudah Dikonversi',
                'asset_category'           => ['id' => $category->id],
                'asset_location'           => ['id' => $location->id],
                'item_id'                  => $item->id,
                'purchase_receipt_item_id' => $receiptItem->id,
                'asset_quantity'           => 1,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['purchase_receipt_item_id']);
    }

    public function test_purchase_receipt_item_mismatched_item_rejected(): void {
        $user         = User::factory()->create();
        $category     = AssetCategory::factory()->create();
        $location     = AssetLocation::factory()->create();
        [, $variantA] = $this->makeFixedAssetItem();
        [$itemB]      = $this->makeFixedAssetItem();
        $receiptItem  = $this->makeReceiptItem($variantA);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'               => 'Item Mismatch',
                'asset_category'           => ['id' => $category->id],
                'asset_location'           => ['id' => $location->id],
                'item_id'                  => $itemB->id,
                'purchase_receipt_item_id' => $receiptItem->id,
                'asset_quantity'           => 1,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['purchase_receipt_item_id']);
    }

    /**
     * asset_quantity SELALU di-override server-side dari baris Receipt
     * (AssetService::applyPurchaseLinkOverrides) -- nilai yang dikirim FE
     * (999, sengaja salah di sini) diabaikan, bukan ditolak. Ini disengaja:
     * FE tidak wajib bisa menghitung nilai akurat sendiri (lihat gap
     * `rate`/`amount` PurchaseInvoiceItem yang ter-gate visibleFor untuk user
     * tanpa akses Purchase -- backend jadi satu-satunya sumber kebenaran).
     */
    public function test_asset_quantity_is_overridden_from_receipt_item_regardless_of_sent_value(): void {
        $user = User::factory()->create();
        // allow_bulk_quantity=true eksplisit -- quantity 3 (dari override
        // Receipt) dicek DUA layer: AssetRequest::validateRentableQuantity()
        // DAN Asset::booted() saving hook, keduanya kini baca field yang sama
        // (allow_bulk_quantity milik Asset sendiri). Default false, jadi wajib
        // dikirim eksplisit di payload di sini.
        $category         = AssetCategory::factory()->create();
        $location         = AssetLocation::factory()->create();
        [$item, $variant] = $this->makeFixedAssetItem();
        $receiptItem      = $this->makeReceiptItem($variant, quantity: 3);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'               => 'Quantity Overridden',
                'asset_category'           => ['id' => $category->id],
                'asset_location'           => ['id' => $location->id],
                'item_id'                  => $item->id,
                'purchase_receipt_item_id' => $receiptItem->id,
                'asset_quantity'           => 999,
                'allow_bulk_quantity'      => true,
            ])
            ->assertRedirect();

        $asset = Asset::where('asset_name', 'Quantity Overridden')->firstOrFail();
        $this->assertEquals(3, $asset->asset_quantity);
    }

    public function test_net_purchase_amount_is_overridden_from_invoice_item_regardless_of_sent_value(): void {
        $user             = User::factory()->create();
        $category         = AssetCategory::factory()->create();
        $location         = AssetLocation::factory()->create();
        [$item, $variant] = $this->makeFixedAssetItem();
        $invoiceItem      = $this->makeInvoiceItem($variant, quantity: 1, rate: 1000);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'               => 'Amount Overridden',
                'asset_category'           => ['id' => $category->id],
                'asset_location'           => ['id' => $location->id],
                'item_id'                  => $item->id,
                'purchase_invoice_item_id' => $invoiceItem->id,
                'net_purchase_amount'      => 999999,
            ])
            ->assertRedirect();

        $asset = Asset::where('asset_name', 'Amount Overridden')->firstOrFail();
        $this->assertEquals($invoiceItem->basic_amount, $asset->net_purchase_amount);
        $this->assertEquals($invoiceItem->amount, $asset->gross_purchase_amount);
    }

    public function test_receipt_and_invoice_from_different_purchase_order_rejected(): void {
        $user             = User::factory()->create();
        $category         = AssetCategory::factory()->create();
        $location         = AssetLocation::factory()->create();
        [$item, $variant] = $this->makeFixedAssetItem();
        $poItemA          = $this->makePurchaseOrderItem($variant);
        $poItemB          = $this->makePurchaseOrderItem($variant);
        $receiptItem      = $this->makeReceiptItem($variant, $poItemA);
        $invoiceItem      = $this->makeInvoiceItem($variant, $poItemB);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'               => 'PO Berbeda',
                'asset_category'           => ['id' => $category->id],
                'asset_location'           => ['id' => $location->id],
                'item_id'                  => $item->id,
                'purchase_receipt_item_id' => $receiptItem->id,
                'purchase_invoice_item_id' => $invoiceItem->id,
                'asset_quantity'           => 1,
                'net_purchase_amount'      => $invoiceItem->basic_amount,
                'gross_purchase_amount'    => $invoiceItem->amount,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['purchase_invoice_item_id']);
    }

    public function test_receipt_and_invoice_from_same_purchase_order_accepted(): void {
        $user = User::factory()->create();
        // allow_bulk_quantity=true -- quantity 2, lihat catatan di
        // test_asset_quantity_is_overridden_from_receipt_item_regardless_of_sent_value.
        $category         = AssetCategory::factory()->create();
        $location         = AssetLocation::factory()->create();
        [$item, $variant] = $this->makeFixedAssetItem();
        $poItem           = $this->makePurchaseOrderItem($variant, quantity: 2, rate: 5000);
        $receiptItem      = $this->makeReceiptItem($variant, $poItem, quantity: 2);
        $invoiceItem      = $this->makeInvoiceItem($variant, $poItem, quantity: 2, rate: 5000);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'               => 'PO Sama',
                'asset_category'           => ['id' => $category->id],
                'asset_location'           => ['id' => $location->id],
                'item_id'                  => $item->id,
                'purchase_receipt_id'      => $receiptItem->purchase_receipt_id,
                'purchase_receipt_item_id' => $receiptItem->id,
                'purchase_invoice_id'      => $invoiceItem->purchase_invoice_id,
                'purchase_invoice_item_id' => $invoiceItem->id,
                'asset_quantity'           => 2,
                'net_purchase_amount'      => $invoiceItem->basic_amount,
                'gross_purchase_amount'    => $invoiceItem->amount,
                'allow_bulk_quantity'      => true,
            ])
            ->assertRedirect();

        $asset = Asset::where('asset_name', 'PO Sama')->firstOrFail();
        $this->assertEquals($receiptItem->id, $asset->purchase_receipt_item_id);
        $this->assertEquals($invoiceItem->id, $asset->purchase_invoice_item_id);
    }

    // Guard kelengkapan pembelian di AssetService::submit() (Requirement 7)
    // di-test di tests/Unit/Asset/AssetServiceSubmitGuardTest.php -- LogicException
    // dari submit() dirender sebagai HTTP 500 (bukan 422, tidak ada mapping
    // ValidationException), jadi pola test resmi yang sudah ada untuk guard
    // ini adalah unit test langsung ke Service, bukan lewat HTTP feature test.
}

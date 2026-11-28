<?php

namespace Tests\Feature\Finances\Tax;

use App\Enums\FormStatus;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\PurchaseInvoiceItemTax;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\SalesInvoiceItemTax;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Models\Inventory\ItemVariant;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Skema dan migrasi data pajak majemuk per item (spek finance-multi-tax-per-item, Task 2.1, 2.2, 2.3, 2.5;
 * Requirement 1.1-1.6, 7.1-7.4): dua tabel pivot aditif, model + relasi, dan backfill satu baris per item ber-`tax_id`
 * dengan pra-pemeriksaan paritas, idempoten, dan `down()` yang hanya mengosongkan pivot.
 */
class InvoiceItemTaxesSchemaTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private PurchaseOrder $purchaseOrder;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, SalesInvoice::class, PurchaseInvoice::class, PurchaseOrder::class]);

        $this->purchaseOrder = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-SCHEMA-1',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
    }

    private function tax(string $name, float $rate, string $category, string $behavior = Tax::BEHAVIOR_ADDITIVE): Tax {
        $tax = Tax::query()->create(['name' => $name, 'rate' => $rate, 'category' => $category, 'behavior' => $behavior]);
        app(TaxRuleVersionService::class)->createInitialVersion($tax);

        return $tax->fresh();
    }

    private function versionOf(Tax $tax): TaxRuleVersion {
        return TaxRuleVersion::query()->where('tax_id', $tax->getKey())->where('status', TaxRuleVersion::STATUS_ACTIVE)->firstOrFail();
    }

    private function salesItem(SalesInvoice $invoice, ?Tax $tax, float $price = 1_000_000): SalesInvoiceItem {
        return SalesInvoiceItem::factory()->create([
            'sales_invoice_id'    => $invoice->id,
            'quantity'            => 1,
            'price'               => $price,
            'discount_amount'     => 0,
            'tax_id'              => $tax?->getKey(),
            'tax_rate'            => $tax?->rate ?? 0,
            'tax_rule_version_id' => $tax === null ? null : $this->versionOf($tax)->getKey(),
        ])->refresh();
    }

    private function purchaseItem(PurchaseInvoice $invoice, ?Tax $tax, float $rate = 1_000_000): PurchaseInvoiceItem {
        return PurchaseInvoiceItem::create([
            'purchase_invoice_id' => $invoice->id,
            'item_id'             => ItemVariant::factory()->create()->id,
            'quantity'            => 1,
            'rate'                => $rate,
            'discount_amount'     => 0,
            'tax_id'              => $tax?->getKey(),
            'tax_rate'            => $tax?->rate ?? 0,
            'tax_rule_version_id' => $tax === null ? null : $this->versionOf($tax)->getKey(),
        ])->refresh();
    }

    private function purchaseInvoice(): PurchaseInvoice {
        return PurchaseInvoice::create([
            'date'              => now()->subDays(3),
            'purchase_order_id' => $this->purchaseOrder->id,
            'branch_id'         => $this->branch->id,
            'status'            => [FormStatus::SUBMITTED],
        ]);
    }

    private function salesInvoice(): SalesInvoice {
        return SalesInvoice::factory()->create(['date' => now()->subDay(), 'branch_id' => $this->branch->id, 'status' => [FormStatus::SUBMITTED]]);
    }

    private function runBackfill(): void {
        (require base_path('database/migrations/2026_11_28_100002_backfill_invoice_item_taxes.php'))->up();
    }

    // ---------------------------------------------------------------------------------------------------------
    // Skema
    // ---------------------------------------------------------------------------------------------------------

    public function test_the_pivot_tables_declare_the_agreed_columns_and_a_unique_item_tax_index(): void {
        foreach (['sales_invoice_item_taxes' => 'sales_invoice_item_id', 'purchase_invoice_item_taxes' => 'purchase_invoice_item_id'] as $table => $foreignKey) {
            $this->assertTrue(Schema::hasTable($table));
            foreach (['id', $foreignKey, 'tax_id', 'tax_rule_version_id', 'position', 'tax_rate', 'dpp_factor', 'base_amount', 'dpp_amount', 'tax_amount', 'withholding_amount', 'created_at', 'updated_at'] as $column) {
                $this->assertTrue(Schema::hasColumn($table, $column), "{$table}.{$column}");
            }

            $unique = collect(Schema::getIndexes($table))->first(fn (array $index): bool => $index['unique'] && ! $index['primary']);
            $this->assertSame([$foreignKey, 'tax_id'], $unique['columns'], "{$table}: unik item + pajak.");
            $this->assertLessThanOrEqual(64, max(array_map('strlen', array_column(Schema::getIndexes($table), 'name'))), 'Nama indeks harus muat di batas MySQL.');
        }
    }

    public function test_the_pivot_is_additive_and_leaves_the_item_columns_untouched(): void {
        foreach (['sales_invoice_items', 'purchase_invoice_items'] as $table) {
            foreach (['tax_id', 'tax_rule_version_id', 'tax_rate', 'dpp_amount', 'tax_amount', 'withholding_amount'] as $column) {
                $this->assertTrue(Schema::hasColumn($table, $column), "{$table}.{$column} tetap ada (cermin Pajak Utama / agregat).");
            }
        }
    }

    public function test_the_same_tax_cannot_be_stored_twice_for_one_item(): void {
        $ppn  = $this->tax('PPN', 12, Tax::CATEGORY_PPN_STANDARD);
        $item = $this->salesItem($this->salesInvoice(), $ppn);

        $item->taxLines()->create(['tax_id' => $ppn->getKey(), 'position' => 0]);

        $this->expectException(QueryException::class);
        $item->taxLines()->create(['tax_id' => $ppn->getKey(), 'position' => 1]);
    }

    public function test_pivot_rows_are_removed_with_their_item(): void {
        $ppn  = $this->tax('PPN', 12, Tax::CATEGORY_PPN_STANDARD);
        $item = $this->salesItem($this->salesInvoice(), $ppn);
        $item->taxLines()->create(['tax_id' => $ppn->getKey(), 'position' => 0]);

        DB::table('sales_invoice_items')->where('id', $item->id)->delete();

        $this->assertSame(0, SalesInvoiceItemTax::query()->count(), 'FK cascade.');
    }

    public function test_models_expose_ordered_relations_and_a_soft_deleted_tax_stays_readable(): void {
        $ppn  = $this->tax('PPN', 12, Tax::CATEGORY_PPN_STANDARD);
        $pph  = $this->tax('PPh 23', 2, Tax::CATEGORY_PPH_23, Tax::BEHAVIOR_WITHHOLDING);
        $item = $this->salesItem($this->salesInvoice(), $ppn);

        $item->taxLines()->create(['tax_id' => $pph->getKey(), 'position' => 1, 'tax_rate' => 2, 'withholding_amount' => 20]);
        $item->taxLines()->create(['tax_id' => $ppn->getKey(), 'position' => 0, 'tax_rate' => 12, 'tax_amount' => 110, 'tax_rule_version_id' => $this->versionOf($ppn)->getKey()]);

        $fresh = SalesInvoiceItem::query()->findOrFail($item->id);
        $this->assertSame([$ppn->getKey(), $pph->getKey()], $fresh->taxLines->pluck('tax_id')->all(), 'taxLines berurut position.');
        $this->assertSame([$ppn->getKey(), $pph->getKey()], $fresh->taxes->pluck('id')->all(), 'taxes berurut position.');
        $this->assertEqualsWithDelta(110, $fresh->taxes[0]->pivot->tax_amount, 0.0001);
        $this->assertSame($fresh->id, $fresh->taxLines[0]->item->id);
        $this->assertSame($ppn->getKey(), $fresh->taxLines[0]->tax->id);
        $this->assertSame($this->versionOf($ppn)->getKey(), $fresh->taxLines[0]->ruleVersion->id);
        $this->assertSame($ppn->getKey(), $fresh->tax->id, 'tax() tetap menunjuk Pajak Utama (kolom item).');

        $pph->delete();
        $this->assertNotNull(SalesInvoiceItem::query()->findOrFail($item->id)->taxLines[1]->tax, 'Pajak terhapus lunak tetap terbaca.');
        $this->assertCount(2, SalesInvoiceItem::query()->findOrFail($item->id)->taxes);
    }

    public function test_mass_assignment_never_sets_the_primary_key(): void {
        $model = new SalesInvoiceItemTax;
        $this->assertSame(['id'], $model->getGuarded());
        $this->assertSame(['id'], (new PurchaseInvoiceItemTax)->getGuarded());
    }

    // ---------------------------------------------------------------------------------------------------------
    // Migrasi data backfill
    // ---------------------------------------------------------------------------------------------------------

    public function test_backfill_creates_one_position_zero_row_per_taxed_item_and_splits_by_behavior(): void {
        $ppn = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);
        $pph = $this->tax('PPh 23', 2, Tax::CATEGORY_PPH_23, Tax::BEHAVIOR_WITHHOLDING);

        $invoice = $this->salesInvoice();
        $taxed   = $this->salesItem($invoice, $ppn);
        $held    = $this->salesItem($invoice, $pph);
        $none    = $this->salesItem($invoice, null);
        $this->assertSame(0, SalesInvoiceItemTax::query()->count());

        $this->runBackfill();

        $this->assertSame(2, SalesInvoiceItemTax::query()->count(), 'Item tanpa tax_id tidak dibuatkan baris.');
        $this->assertSame(0, SalesInvoiceItemTax::query()->where('sales_invoice_item_id', $none->id)->count());

        $line = SalesInvoiceItemTax::query()->where('sales_invoice_item_id', $taxed->id)->firstOrFail();
        $this->assertSame(0, $line->position);
        $this->assertSame($ppn->getKey(), $line->tax_id);
        $this->assertSame($taxed->tax_rule_version_id, $line->tax_rule_version_id);
        $this->assertEqualsWithDelta(12, $line->tax_rate, 0.0001);
        $this->assertEqualsWithDelta($taxed->basic_amount - $taxed->discount_amount, $line->base_amount, 0.0001);
        $this->assertEqualsWithDelta($taxed->dpp_amount, $line->dpp_amount, 0.0001);
        $this->assertEqualsWithDelta($taxed->tax_amount, $line->tax_amount, 0.0001);
        $this->assertEqualsWithDelta(0, $line->withholding_amount, 0.0001);
        $this->assertEqualsWithDelta(11 / 12, $line->dpp_factor, 0.0001, 'Faktor DPP dari versi aturan.');

        $heldLine = SalesInvoiceItemTax::query()->where('sales_invoice_item_id', $held->id)->firstOrFail();
        $this->assertEqualsWithDelta(0, $heldLine->tax_amount, 0.0001, 'Pajak potong tidak mengisi tax_amount.');
        $this->assertEqualsWithDelta($held->withholding_amount, $heldLine->withholding_amount, 0.0001);
        $this->assertGreaterThan(0, $heldLine->withholding_amount);

        $this->assertEqualsWithDelta(SalesInvoiceItem::query()->sum('tax_amount'), SalesInvoiceItemTax::query()->sum('tax_amount'), 0.01, 'Paritas Σ pivot = Σ item.');
    }

    public function test_backfill_also_covers_purchase_invoice_items(): void {
        $ppn  = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);
        $item = $this->purchaseItem($this->purchaseInvoice(), $ppn);

        $this->runBackfill();

        $line = PurchaseInvoiceItemTax::query()->where('purchase_invoice_item_id', $item->id)->firstOrFail();
        $this->assertEqualsWithDelta($item->tax_amount, $line->tax_amount, 0.0001);
        $this->assertSame(1, PurchaseInvoiceItemTax::query()->count());
    }

    public function test_backfill_is_idempotent_and_leaves_existing_pivot_rows_alone(): void {
        $ppn = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);
        $pph = $this->tax('PPh 23', 2, Tax::CATEGORY_PPH_23, Tax::BEHAVIOR_WITHHOLDING);

        $invoice = $this->salesInvoice();
        $legacy  = $this->salesItem($invoice, $ppn);
        $multi   = $this->salesItem($invoice, $ppn);
        // Item majemuk yang sudah punya pivot: dua baris, agregat item = Σ pivot.
        $multi->taxLines()->create(['tax_id' => $ppn->getKey(), 'position' => 0, 'tax_amount' => $multi->tax_amount, 'dpp_amount' => $multi->dpp_amount]);
        $multi->taxLines()->create(['tax_id' => $pph->getKey(), 'position' => 1, 'withholding_amount' => 50]);
        $multi->forceFill(['withholding_amount' => 50])->saveQuietly();

        $this->runBackfill();
        $snapshot = SalesInvoiceItemTax::query()->orderBy('id')->get(['id', 'tax_id', 'position', 'tax_amount', 'withholding_amount'])->toArray();
        $this->assertSame(3, \count($snapshot), 'Hanya item legacy yang dibuatkan baris; item majemuk tidak disentuh.');

        $this->runBackfill();
        $this->assertSame($snapshot, SalesInvoiceItemTax::query()->orderBy('id')->get(['id', 'tax_id', 'position', 'tax_amount', 'withholding_amount'])->toArray(), 'Jalan ulang tidak mengubah apa pun.');
        $this->assertSame(1, SalesInvoiceItemTax::query()->where('sales_invoice_item_id', $legacy->id)->count());
    }

    public function test_withholding_tax_stored_as_tax_amount_stops_the_backfill_and_lists_the_documents(): void {
        $pph  = $this->tax('PPh 23', 2, Tax::CATEGORY_PPH_23, Tax::BEHAVIOR_WITHHOLDING);
        $ppn  = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);
        $good = $this->salesItem($this->salesInvoice(), $ppn);

        // Pajak potong yang tersimpan sebagai tax_amount (data tak konsisten dengan taxes.behavior): berhenti, tidak dinormalisasi.
        $badInvoice = $this->salesInvoice();
        $bad        = $this->salesItem($badInvoice, $pph);
        DB::table('sales_invoice_items')->where('id', $bad->id)->update(['tax_amount' => 500, 'withholding_amount' => 0]);

        try {
            $this->runBackfill();
            $this->fail('Backfill harus berhenti.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('berpajak potong', $e->getMessage());
            $this->assertStringContainsString('sales_invoice_items', $e->getMessage());
            $this->assertStringContainsString($badInvoice->getKey(), $e->getMessage(), 'Dokumen bermasalah didaftar.');
        }

        $this->assertSame(0, SalesInvoiceItemTax::query()->where('sales_invoice_item_id', $good->id)->count(), 'Transaksi dibatalkan: tidak ada baris tersisa.');
        $this->assertSame(0, SalesInvoiceItemTax::query()->count());
    }

    public function test_the_parity_check_is_per_document_and_names_the_failing_document(): void {
        $ppn = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);

        // Pajak tambah dengan withholding_amount tidak nol: pivot (withholding 0) tidak sama dengan item. Dokumen lain konsisten.
        $badInvoice = $this->salesInvoice();
        $bad        = $this->salesItem($badInvoice, $ppn);
        DB::table('sales_invoice_items')->where('id', $bad->id)->update(['withholding_amount' => 300]);
        $okInvoice = $this->salesInvoice();
        $this->salesItem($okInvoice, $ppn);

        try {
            $this->runBackfill();
            $this->fail('Paritas harus gagal.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Pra-pemeriksaan paritas gagal', $e->getMessage());
            $this->assertStringContainsString($badInvoice->getKey(), $e->getMessage());
            $this->assertStringNotContainsString($okInvoice->getKey(), $e->getMessage());
        }

        $this->assertSame(0, SalesInvoiceItemTax::query()->count(), 'Transaksi dibatalkan.');
    }

    public function test_legacy_dpp_factor_applies_to_ppn_taxes_only(): void {
        $ppn = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);
        $pph = $this->tax('PPh 23', 2, Tax::CATEGORY_PPH_23, Tax::BEHAVIOR_WITHHOLDING);

        $invoice = $this->salesInvoice();
        $ppnItem = $this->salesItem($invoice, $ppn);
        $pphItem = $this->salesItem($invoice, $pph);
        // Item lama tanpa versi aturan.
        DB::table('sales_invoice_items')->whereIn('id', [$ppnItem->id, $pphItem->id])->update(['tax_rule_version_id' => null]);

        $this->runBackfill();

        $this->assertEqualsWithDelta(11 / 12, SalesInvoiceItemTax::query()->where('sales_invoice_item_id', $ppnItem->id)->firstOrFail()->dpp_factor, 0.0001);
        $this->assertEqualsWithDelta(1, SalesInvoiceItemTax::query()->where('sales_invoice_item_id', $pphItem->id)->firstOrFail()->dpp_factor, 0.0001, 'Non-PPN tanpa versi: faktor 1.');
    }

    public function test_down_only_empties_the_pivot_tables(): void {
        $ppn  = $this->tax('PPN 12', 12, Tax::CATEGORY_PPN_STANDARD);
        $item = $this->salesItem($this->salesInvoice(), $ppn);
        $this->runBackfill();
        $this->assertSame(1, SalesInvoiceItemTax::query()->count());

        (require base_path('database/migrations/2026_11_28_100002_backfill_invoice_item_taxes.php'))->down();

        $this->assertTrue(Schema::hasTable('sales_invoice_item_taxes'), 'Tabel milik migrasi pembuat tetap ada.');
        $this->assertSame(0, SalesInvoiceItemTax::query()->count());
        $fresh = SalesInvoiceItem::query()->findOrFail($item->id);
        $this->assertSame($ppn->getKey(), $fresh->tax_id, 'Kolom item tidak diubah.');
        $this->assertEqualsWithDelta($item->tax_amount, $fresh->tax_amount, 0.0001);
    }

    public function test_the_create_migration_drops_both_tables_on_down(): void {
        $migration = require base_path('database/migrations/2026_11_28_100001_create_invoice_item_taxes_tables.php');
        $migration->down();

        $this->assertFalse(Schema::hasTable('sales_invoice_item_taxes'));
        $this->assertFalse(Schema::hasTable('purchase_invoice_item_taxes'));

        $migration->up();
        $this->assertTrue(Schema::hasTable('sales_invoice_item_taxes'), 'up() dapat dijalankan ulang.');
    }
}

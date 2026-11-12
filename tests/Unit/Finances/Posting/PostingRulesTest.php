<?php

namespace Tests\Unit\Finances\Posting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Exceptions\Finances\UnknownPostingDocumentTypeException;
use App\Models\Finances\PostingProfileRule;
use App\Services\Finances\Posting\AccountRuleMatcher;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingRuleRegistry;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;
use App\Services\Finances\Posting\Rules\PostingRule;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use LogicException;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 4.1-4.3: rule murni tanpa DB (P-2). Setiap rule menghasilkan jumlah jurnal, sisi, peran, dan
 * `purpose` identik dengan jalur Fase 1 (peta rule di design.md), termasuk retur, jumlah nol, dan baris peka-barang.
 * P-11 bagian "sisi ditukar": retur tanpa aturan khusus memakai akun normal (matcher) dengan sisi ditukar (rule).
 */
class PostingRulesTest extends TestCase {
    private PostingRuleRegistry $registry;

    protected function setUp(): void {
        parent::setUp();

        // P-2: setiap query ke DB selama pengujian rule menggagalkan test dengan cepat (tanpa bergantung pada host).
        DB::listen(static function (): void {
            throw new LogicException('PostingRule menyentuh DB (melanggar P-2).');
        });

        $this->registry = new PostingRuleRegistry;
    }

    /**
     * @param  array<string, float|int>  $amounts
     * @param  array<string, mixed>  $flags
     * @param  list<LineAttributes>  $lines
     */
    private function ctx(PostingDocumentType $type, array $amounts = [], array $flags = [], array $lines = []): PostingContext {
        return new PostingContext($type, 'App\\Models\\Doc', '01DOC', CarbonImmutable::parse('2026-11-12'), null, $amounts, $flags, [], $lines);
    }

    /**
     * @return list<RoleJournalDraft>
     */
    private function build(PostingContext $ctx): array {
        return $this->registry->for($ctx->documentType)->build($ctx);
    }

    /**
     * Bentuk jurnal sebagai daftar `side:role:amount`, terurut urutan baris.
     *
     * @return list<string>
     */
    private function shape(RoleJournalDraft $draft): array {
        return array_map(fn (RoleLine $line): string => "{$line->side}:{$line->roleValue()}:{$line->amount}", $draft->lines);
    }

    public function test_the_db_guard_itself_fails_fast_on_any_query(): void {
        $this->expectException(LogicException::class);
        DB::select('select 1');
    }

    public function test_registry_has_a_rule_for_every_document_type_and_rejects_unknown(): void {
        foreach (PostingDocumentType::cases() as $type) {
            $this->assertInstanceOf(PostingRule::class, $this->registry->for($type));
            $this->assertSame($type, $this->registry->for($type)->documentType());
        }

        $this->expectException(UnknownPostingDocumentTypeException::class);
        (new PostingRuleRegistry([]))->for(PostingDocumentType::SalesInvoice);
    }

    public function test_sales_invoice_normal_return_and_zero(): void {
        $normal = $this->build($this->ctx(PostingDocumentType::SalesInvoice, ['total' => 1500]));
        $this->assertCount(1, $normal);
        $this->assertSame('default', $normal[0]->purpose);
        $this->assertSame(['debit:receivable:1500', 'credit:revenue:1500'], $this->shape($normal[0]));

        $return = $this->build($this->ctx(PostingDocumentType::SalesInvoice, ['total' => 1500], ['is_return' => true]));
        $this->assertSame(['credit:receivable:1500', 'debit:revenue:1500'], $this->shape($return[0]));

        $this->assertSame([], $this->build($this->ctx(PostingDocumentType::SalesInvoice, ['total' => 0])));
    }

    public function test_sales_invoice_line_sensitive_revenue_lines_carry_item_attributes(): void {
        $stock    = new LineAttributes(['amount' => 600], isStockItem: true);
        $service  = new LineAttributes(['amount' => 400], isStockItem: false);
        $drafts   = $this->build($this->ctx(PostingDocumentType::SalesInvoice, ['total' => 1000], lines: [$stock, $service]));
        $revenues = array_values(array_filter($drafts[0]->lines, fn (RoleLine $line): bool => $line->roleValue() === 'revenue'));

        $this->assertCount(2, $revenues);
        $this->assertSame($stock, $revenues[0]->line);
        $this->assertSame($service, $revenues[1]->line);
        $this->assertSame(1000.0, array_sum(array_map(fn (RoleLine $l): float => (float) $l->amount, $revenues)), 'P-12: jumlah baris = total');
    }

    public function test_purchase_invoice_stock_and_expense_journals(): void {
        $drafts = $this->build($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 1000, 'stock_total' => 600]));
        $this->assertSame(['stock', 'expense'], array_map(fn (RoleJournalDraft $d): string => $d->purpose, $drafts));
        $this->assertSame(['debit:stock:600', 'credit:stock_received_but_not_billed:600'], $this->shape($drafts[0]));
        $this->assertSame(['debit:expense:1000', 'credit:payable:1000'], $this->shape($drafts[1]));

        // stock_total 0 -> hanya jurnal expense.
        $onlyExpense = $this->build($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 1000, 'stock_total' => 0]));
        $this->assertSame(['expense'], array_map(fn (RoleJournalDraft $d): string => $d->purpose, $onlyExpense));
    }

    public function test_purchase_invoice_return_has_no_stock_journal_and_swaps_expense(): void {
        $drafts = $this->build($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 1000, 'stock_total' => 600], ['is_return' => true]));

        $this->assertCount(1, $drafts);
        $this->assertSame('expense', $drafts[0]->purpose);
        $this->assertSame(['credit:expense:1000', 'debit:payable:1000'], $this->shape($drafts[0]));
    }

    public function test_purchase_invoice_expense_lines_split_per_line_and_zero_total_yields_nothing(): void {
        $lines  = [new LineAttributes(['amount' => 700], isStockItem: true), new LineAttributes(['amount' => 300], isStockItem: false)];
        $drafts = $this->build($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 1000], lines: $lines));

        $this->assertSame(['debit:expense:700', 'debit:expense:300', 'credit:payable:1000'], $this->shape($drafts[0]));
        $this->assertSame([], $this->build($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 0, 'stock_total' => 0])));
    }

    public function test_purchase_receipt_and_delivery_note_normal_return_zero(): void {
        $receipt = $this->build($this->ctx(PostingDocumentType::PurchaseReceipt, ['total' => 800]));
        $this->assertSame(['debit:stock:800', 'credit:stock_received_but_not_billed:800'], $this->shape($receipt[0]));
        $receiptReturn = $this->build($this->ctx(PostingDocumentType::PurchaseReceipt, ['total' => 800], ['is_return' => true]));
        $this->assertSame(['debit:stock_received_but_not_billed:800', 'credit:stock:800'], $this->shape($receiptReturn[0]));
        $this->assertSame([], $this->build($this->ctx(PostingDocumentType::PurchaseReceipt, ['total' => 0])));

        $delivery = $this->build($this->ctx(PostingDocumentType::DeliveryNote, ['total_picked' => 300]));
        $this->assertSame(['debit:cost_of_goods_sold:300', 'credit:stock:300'], $this->shape($delivery[0]));
        $deliveryReturn = $this->build($this->ctx(PostingDocumentType::DeliveryNote, ['total_picked' => 300], ['is_return' => true]));
        $this->assertSame(['debit:stock:300', 'credit:cost_of_goods_sold:300'], $this->shape($deliveryReturn[0]));
        $this->assertSame([], $this->build($this->ctx(PostingDocumentType::DeliveryNote, ['total_picked' => 0])));
    }

    public function test_payment_entry_direction_follows_payment_type_and_paymentable_kind(): void {
        $cases = [
            ['receive', 'sales_invoice', ['debit:cash_or_bank:250', 'credit:receivable:250']],
            ['pay', 'purchase_invoice', ['debit:payable:250', 'credit:cash_or_bank:250']],
            ['pay', 'sales_invoice', ['debit:receivable:250', 'credit:cash_or_bank:250']],
            ['receive', 'purchase_invoice', ['debit:cash_or_bank:250', 'credit:payable:250']],
        ];

        foreach ($cases as [$paymentType, $kind, $expected]) {
            $drafts = $this->build($this->ctx(PostingDocumentType::PaymentEntry, ['paid_amount' => 250], ['payment_type' => $paymentType, 'paymentable_kind' => $kind]));
            $this->assertSame('default', $drafts[0]->purpose);
            $this->assertSame($expected, $this->shape($drafts[0]), "{$paymentType}/{$kind}");
        }

        $this->assertSame([], $this->build($this->ctx(PostingDocumentType::PaymentEntry, ['paid_amount' => 0], ['payment_type' => 'receive', 'paymentable_kind' => 'sales_invoice'])));
    }

    public function test_payment_entry_internal_transfer_is_unsupported_and_fails_hard(): void {
        $this->expectException(LogicException::class);
        $this->build($this->ctx(PostingDocumentType::PaymentEntry, ['paid_amount' => 10], ['payment_type' => 'internal_transfer', 'paymentable_kind' => 'sales_invoice']));
    }

    public function test_asset_depreciation_only_when_positive(): void {
        $drafts = $this->build($this->ctx(PostingDocumentType::AssetDepreciation, ['depreciation_amount' => 120]));
        $this->assertSame('depreciation', $drafts[0]->purpose);
        $this->assertSame(['debit:depreciation_expense:120', 'credit:accumulated_depreciation:120'], $this->shape($drafts[0]));

        $this->assertSame([], $this->build($this->ctx(PostingDocumentType::AssetDepreciation, ['depreciation_amount' => 0])));
    }

    public function test_asset_scrap_write_off_has_no_gain_loss_line(): void {
        $drafts = $this->build($this->ctx(PostingDocumentType::AssetScrap, ['write_off_amount' => 900], ['is_depreciable' => true]));
        $this->assertSame('write_off', $drafts[0]->purpose);
        $this->assertSame(['debit:accumulated_depreciation:900', 'credit:fixed_asset:900'], $this->shape($drafts[0]));

        $this->assertSame([], $this->build($this->ctx(PostingDocumentType::AssetScrap, ['write_off_amount' => 0], ['is_depreciable' => true])));
        $this->assertSame([], $this->build($this->ctx(PostingDocumentType::AssetScrap, ['write_off_amount' => 900], ['is_depreciable' => false])));
    }

    public function test_asset_value_adjustment_swaps_sides_on_decrease(): void {
        $up = $this->build($this->ctx(PostingDocumentType::AssetValueAdjustment, ['difference_amount' => 500]));
        $this->assertSame('value_adjustment', $up[0]->purpose);
        $this->assertSame(['debit:fixed_asset:500', 'credit:asset_revaluation:500'], $this->shape($up[0]));

        $down = $this->build($this->ctx(PostingDocumentType::AssetValueAdjustment, ['difference_amount' => -500]));
        $this->assertSame(['debit:asset_revaluation:500', 'credit:fixed_asset:500'], $this->shape($down[0]));

        $this->assertSame([], $this->build($this->ctx(PostingDocumentType::AssetValueAdjustment, ['difference_amount' => 0])));
    }

    public function test_asset_disposal_keeps_legacy_direction_and_per_line_key(): void {
        $gain = $this->build($this->ctx(PostingDocumentType::AssetDisposal, ['gain_loss' => 200], ['sales_invoice_item_id' => 'L1']));
        $this->assertSame('disposal:L1', $gain[0]->purpose);
        $this->assertSame(['debit:gain_loss_disposal:200', 'credit:fixed_asset:200'], $this->shape($gain[0]));

        $loss = $this->build($this->ctx(PostingDocumentType::AssetDisposal, ['gain_loss' => -200], ['sales_invoice_item_id' => 'L1']));
        $this->assertSame(['debit:fixed_asset:200', 'credit:gain_loss_disposal:200'], $this->shape($loss[0]));

        $this->assertSame([], $this->build($this->ctx(PostingDocumentType::AssetDisposal, ['gain_loss' => 0.00005], ['sales_invoice_item_id' => 'L1'])));
    }

    public function test_stock_entry_receipt_issue_and_additional_costs(): void {
        $receipt = $this->build($this->ctx(PostingDocumentType::StockEntry, ['basic_total' => 1000], ['entry_type' => 'item_receipt']));
        $this->assertSame('default', $receipt[0]->purpose);
        $this->assertSame(['debit:stock:1000', 'credit:stock_adjustment:1000'], $this->shape($receipt[0]));

        $issue = $this->build($this->ctx(PostingDocumentType::StockEntry, ['basic_total' => 1000], ['entry_type' => 'item_issue']));
        $this->assertSame(['credit:stock:1000', 'debit:stock_adjustment:1000'], $this->shape($issue[0]));

        $costs     = [['id' => 'C1', 'amount' => 50], ['id' => 'C2', 'amount' => 0], ['id' => 'C3', 'amount' => 25]];
        $withCosts = $this->build($this->ctx(PostingDocumentType::StockEntry, ['basic_total' => 1000], ['entry_type' => 'item_receipt', 'additional_costs' => $costs]));
        $this->assertSame(['default', 'additional_cost:C1', 'additional_cost:C3'], array_map(fn (RoleJournalDraft $d): string => $d->purpose, $withCosts));
        $this->assertSame(['debit:stock:50', 'credit:expense_included_in_valuation:50'], $this->shape($withCosts[1]));
    }

    public function test_stock_entry_transfer_and_consumption_have_no_main_journal_but_additional_costs_still_post(): void {
        foreach (['item_transfer', 'item_consumption'] as $type) {
            $this->assertSame([], $this->build($this->ctx(PostingDocumentType::StockEntry, ['basic_total' => 1000], ['entry_type' => $type])), $type);

            $drafts = $this->build($this->ctx(PostingDocumentType::StockEntry, ['basic_total' => 1000], ['entry_type' => $type, 'additional_costs' => [['id' => 'C1', 'amount' => 30]]]));
            $this->assertSame(['additional_cost:C1'], array_map(fn (RoleJournalDraft $d): string => $d->purpose, $drafts), $type);
        }
    }

    public function test_stock_entry_adjustment_lines_split_per_line_while_stock_side_stays_document_level(): void {
        $lines  = [new LineAttributes(['amount' => 400], isStockItem: true), new LineAttributes(['amount' => 600], isStockItem: true)];
        $drafts = $this->build($this->ctx(PostingDocumentType::StockEntry, ['basic_total' => 1000], ['entry_type' => 'item_receipt'], $lines));

        $this->assertSame(['debit:stock:1000', 'credit:stock_adjustment:400', 'credit:stock_adjustment:600'], $this->shape($drafts[0]));
    }

    public function test_every_draft_is_balanced_for_all_rules(): void {
        $contexts = [
            $this->ctx(PostingDocumentType::SalesInvoice, ['total' => 99.5], ['is_return' => true], [new LineAttributes(['amount' => 50]), new LineAttributes(['amount' => 49.5])]),
            $this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 80, 'stock_total' => 30]),
            $this->ctx(PostingDocumentType::StockEntry, ['basic_total' => 70], ['entry_type' => 'item_issue', 'additional_costs' => [['id' => 'X', 'amount' => 5]]]),
        ];

        foreach ($contexts as $ctx) {
            foreach ($this->build($ctx) as $draft) {
                $debit  = array_sum(array_map(fn (RoleLine $l): float => $l->side === 'debit' ? (float) $l->amount : 0.0, $draft->lines));
                $credit = array_sum(array_map(fn (RoleLine $l): float => $l->side === 'credit' ? (float) $l->amount : 0.0, $draft->lines));
                $this->assertEqualsWithDelta($debit, $credit, 1e-9, "{$ctx->documentType->value}/{$draft->purpose}");
            }
        }
    }

    public function test_return_without_a_return_rule_uses_the_normal_account_and_swapped_sides(): void {
        // P-11: aturan normal (variant null) menang untuk konteks retur bila tidak ada aturan `return`...
        $normalRule = (new PostingProfileRule)->forceFill(['role' => 'revenue', 'account_id' => 'ACC-SALES', 'priority' => 0, 'document_type' => 'sales_invoice']);
        $matcher    = new AccountRuleMatcher;

        $returnCtx = $this->ctx(PostingDocumentType::SalesInvoice, ['total' => 100], ['is_return' => true]);
        $normalCtx = $this->ctx(PostingDocumentType::SalesInvoice, ['total' => 100]);
        $this->assertSame('ACC-SALES', $matcher->match([$normalRule], AccountRole::Revenue, $returnCtx)->account_id);
        $this->assertSame('ACC-SALES', $matcher->match([$normalRule], AccountRole::Revenue, $normalCtx)->account_id);

        // ...dan rule menukar sisi, bukan peran.
        $normal = $this->build($normalCtx)[0];
        $return = $this->build($returnCtx)[0];
        $this->assertSame(['debit:receivable:100', 'credit:revenue:100'], $this->shape($normal));
        $this->assertSame(['credit:receivable:100', 'debit:revenue:100'], $this->shape($return));
    }
}

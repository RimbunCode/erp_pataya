<?php

namespace Tests\Unit\Finances\Posting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 2.1/3.5: katalog peran (Requirement 1) dan penanda peka-barang (Requirement 12.4).
 */
class AccountRoleTest extends TestCase {
    public function test_catalog_contains_every_role_of_requirement_1_1(): void {
        $expected = [
            'receivable', 'payable', 'revenue', 'cost_of_goods_sold', 'stock', 'stock_received_but_not_billed', 'expense',
            'stock_adjustment', 'expense_included_in_valuation', 'fixed_asset', 'accumulated_depreciation',
            'depreciation_expense', 'capital_work_in_progress', 'gain_loss_disposal', 'asset_revaluation', 'cash_or_bank', 'tax_output',
            'tax_input', 'withholding_receivable', 'withholding_payable', 'rounding', 'discount', 'fx_gain', 'fx_loss',
        ];

        $this->assertEqualsCanonicalizing($expected, AccountRole::values());
    }

    public function test_posting_document_types_are_the_ten_posting_points(): void {
        $this->assertEqualsCanonicalizing([
            'sales_invoice', 'purchase_invoice', 'purchase_receipt', 'delivery_note', 'payment_entry', 'stock_entry',
            'asset_depreciation', 'asset_scrap', 'asset_value_adjustment', 'asset_disposal',
        ], PostingDocumentType::values());
    }

    /**
     * Pasangan `[root_type, account_type]` yang benar-benar dicari kode sumber (listener, StockEntryService, controller).
     *
     * @return list<string> "root/type"
     */
    private function pairsFoundIn(array $relativePaths): array {
        $pairs = [];
        foreach ($relativePaths as $path) {
            $source = file_get_contents(base_path($path));
            $this->assertNotFalse($source, $path);
            preg_match_all("/where\\('root_type',\\s*'(\\w+)'\\)\\s*->where\\('account_type',\\s*'(\\w+)'\\)/", $source, $matches, PREG_SET_ORDER);
            foreach ($matches as $match) {
                $pairs[] = "{$match[1]}/{$match[2]}";
            }
        }

        return array_values(array_unique($pairs));
    }

    public function test_legacy_pair_matches_the_lookups_in_the_real_phase_one_sources(): void {
        $latestLookups = $this->pairsFoundIn([
            'app/Listeners/Purchase/Ledger/PostPurchaseReceiptGeneralLedger.php',
            'app/Listeners/Finances/Ledger/PostPurchaseInvoiceGeneralLedger.php',
            'app/Listeners/Inventory/Ledger/PostDeliveryNoteGeneralLedger.php',
            'app/Services/Inventory/StockEntryService.php',
        ]);
        foreach ([AccountRole::Stock, AccountRole::StockReceivedButNotBilled, AccountRole::CostOfGoodsSold] as $role) {
            $this->assertContains(implode('/', $role->legacyPair()), $latestLookups, $role->value);
        }

        $controllerDefaults = $this->pairsFoundIn([
            'app/Http/Controllers/Finances/SalesInvoiceController.php',
            'app/Http/Controllers/Finances/PurchaseInvoiceController.php',
        ]);
        foreach ([AccountRole::Receivable, AccountRole::Payable, AccountRole::Revenue, AccountRole::Expense] as $role) {
            $this->assertContains(implode('/', $role->legacyPair()), $controllerDefaults, $role->value);
        }
    }

    public function test_roles_without_a_code_lookup_take_their_pair_from_the_account_seeder(): void {
        $seeder = file_get_contents(base_path('database/seeders/AccountSeeder.php'));

        foreach ([AccountRole::StockAdjustment, AccountRole::ExpenseIncludedInValuation, AccountRole::Discount] as $role) {
            [, $type] = $role->legacyPair();
            $this->assertMatchesRegularExpression("/'account_type'\\s*=>\\s*'{$type}'/", $seeder, $role->value);
        }
        $this->assertStringContainsString("'root_type'      => 'expense'", $seeder);
    }

    public function test_purchase_invoice_expense_role_defaults_to_the_srnb_pair_for_parity(): void {
        $this->assertSame(AccountRole::StockReceivedButNotBilled->legacyPair(), AccountRole::Expense->legacyPair());
    }

    public function test_master_and_unused_roles_have_no_legacy_pair(): void {
        foreach ([
            AccountRole::CashOrBank, AccountRole::FixedAsset, AccountRole::AccumulatedDepreciation, AccountRole::DepreciationExpense,
            AccountRole::CapitalWorkInProgress, AccountRole::GainLossDisposal, AccountRole::AssetRevaluation, AccountRole::TaxOutput, AccountRole::TaxInput,
            AccountRole::WithholdingReceivable, AccountRole::WithholdingPayable, AccountRole::Rounding, AccountRole::FxGain, AccountRole::FxLoss,
        ] as $role) {
            $this->assertNull($role->legacyPair(), $role->value);
        }
    }

    public function test_legacy_pairs_are_well_formed(): void {
        foreach (AccountRole::cases() as $role) {
            $pair = $role->legacyPair();
            if ($pair !== null) {
                $this->assertCount(2, $pair, $role->value);
                $this->assertContains($pair[0], ['asset', 'liability', 'equity', 'income', 'expense'], $role->value);
                $this->assertNotSame('', $pair[1], $role->value);
            }
        }
    }

    public function test_line_sensitive_roles_match_requirement_12_4(): void {
        $sensitive = array_values(array_map(
            fn (AccountRole $role) => $role->value,
            array_filter(AccountRole::cases(), fn (AccountRole $role) => $role->isLineSensitive()),
        ));

        $this->assertEqualsCanonicalizing(
            ['revenue', 'expense', 'cost_of_goods_sold', 'stock', 'stock_adjustment', 'expense_included_in_valuation'],
            $sensitive,
        );
        $this->assertFalse(AccountRole::Receivable->isLineSensitive());
        $this->assertFalse(AccountRole::CashOrBank->isLineSensitive());
        $this->assertTrue(AccountRole::isLineSensitiveRole('revenue'));
        $this->assertFalse(AccountRole::isLineSensitiveRole('custom_tax_role'));
    }

    public function test_every_role_has_a_label_in_both_locales(): void {
        foreach (['id', 'en'] as $locale) {
            app()->setLocale($locale);
            foreach (AccountRole::cases() as $role) {
                $this->assertNotSame("finances/postingRole.roles.{$role->value}", $role->label(), "{$locale}: {$role->value}");
            }
        }
    }
}

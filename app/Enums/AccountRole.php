<?php

namespace App\Enums;

/**
 * Katalog peran akun (Finance Fase 2, Requirement 1). Peran adalah kunci logis akun yang di-resolve
 * `AccountRoleResolver` menjadi `accounts.id`; Posting Rule hanya menyebut peran, tidak pernah akun.
 *
 * Peran profil boleh juga berupa string kustom di luar enum ini (Requirement 1.3; dipakai Fase 3), karena itu
 * kolom `posting_profile_accounts.role` bertipe string, bukan enum.
 */
enum AccountRole: string {
    case Receivable                 = 'receivable';
    case Payable                    = 'payable';
    case Revenue                    = 'revenue';
    case CostOfGoodsSold            = 'cost_of_goods_sold';
    case Stock                      = 'stock';
    case StockReceivedButNotBilled  = 'stock_received_but_not_billed';
    case Expense                    = 'expense';
    case StockAdjustment            = 'stock_adjustment';
    case ExpenseIncludedInValuation = 'expense_included_in_valuation';
    case FixedAsset                 = 'fixed_asset';
    case AccumulatedDepreciation    = 'accumulated_depreciation';
    case DepreciationExpense        = 'depreciation_expense';
    case CapitalWorkInProgress      = 'capital_work_in_progress';
    case GainLossDisposal           = 'gain_loss_disposal';
    case AssetRevaluation           = 'asset_revaluation';
    case CashOrBank                 = 'cash_or_bank';
    case TaxOutput                  = 'tax_output';
    case TaxInput                   = 'tax_input';
    case WithholdingReceivable      = 'withholding_receivable';
    case WithholdingPayable         = 'withholding_payable';
    case Rounding                   = 'rounding';
    case Discount                   = 'discount';
    case FxGain                     = 'fx_gain';
    case FxLoss                     = 'fx_loss';

    /**
     * Pasangan legacy `[root_type, account_type]`, atau null bila peran tidak punya padanan. Sumber pasangan ini
     * berbeda per peran (diverifikasi `AccountRoleTest` terhadap kode sumber):
     *
     * - `Stock`, `StockReceivedButNotBilled`, `CostOfGoodsSold`: pencarian `where('root_type', ...)
     *   ->where('account_type', ...)->latest()->first()` pada listener Purchase Receipt/Purchase Invoice/Delivery Note
     *   dan `StockEntryService`.
     * - `Receivable`, `Payable`, `Revenue`, `Expense`: jalur lama adalah default form yang diisi controller
     *   (`SalesInvoiceController`, `PurchaseInvoiceController`) lewat `->get()->first()` tanpa urutan, dengan
     *   `is_contra = false` pada jalur normal Sales Invoice (jalur retur `SalesInvoiceController` memakai
     *   `is_contra = true`); bukan `latest()`. Fallback legacy resolver memakai `orderBy('id')`: satu kandidat dipakai
     *   dengan peringatan, lebih dari satu kandidat melempar `UnresolvedAccountRoleException` (fail-closed, Q-P2-6);
     *   peran ambigu wajib dipetakan di profil.
     * - `AssetRevaluation` (akun selisih Asset Value Adjustment, dipilih pengguna hari ini): tidak ada pencarian di
     *   kode dan tidak ada `account_type` di `AccountSeeder` yang dapat diturunkan, jadi null (dipetakan di profil).
     * - `StockAdjustment`, `ExpenseIncludedInValuation`, `Discount`: tidak ada pencarian di kode (akun selisih/biaya
     *   dipilih pengguna); pasangan diambil dari `AccountSeeder`.
     *
     * - `Expense` memetakan ke akun SRNB demi parity: `expanse_head_account_id` Purchase Invoice diisi controller
     *   dengan akun SRNB, sehingga dua jurnal Purchase Invoice saling melawan melalui SRNB (design.md, T-9).
     * - Peran aset tetap dan `CashOrBank` adalah akun master (`AssetCategoryAccount`, `PaymentMethod`), bukan
     *   pencarian `account_type`; peran pajak/pembulatan/kurs belum dipakai kode Fase 1 (Q-P2-2, Fase 3 dan 4).
     *
     * @return array{0: string, 1: string}|null
     */
    public function legacyPair(): ?array {
        return match ($this) {
            self::Receivable                 => ['asset', 'receivable'],
            self::Payable                    => ['liability', 'payable'],
            self::Revenue                    => ['income', 'income_account'],
            self::CostOfGoodsSold            => ['income', 'cost_of_goods_sold'],
            self::Stock                      => ['asset', 'stock'],
            self::StockReceivedButNotBilled  => ['liability', 'stock_received_but_not_billed'],
            self::Expense                    => ['liability', 'stock_received_but_not_billed'],
            self::StockAdjustment            => ['expense', 'stock_adjustment'],
            self::ExpenseIncludedInValuation => ['liability', 'expense_included_in_valuation'],
            self::Discount                   => ['income', 'discount'],
            default                          => null,
        };
    }

    /**
     * Peran peka-barang (Requirement 12.4): dievaluasi per baris `lines` dan dapat memiliki aturan akun bersyarat
     * dengan kondisi atribut barang. Peran tingkat dokumen dievaluasi sekali.
     */
    public function isLineSensitive(): bool {
        return match ($this) {
            self::Revenue,
            self::Expense,
            self::CostOfGoodsSold,
            self::Stock,
            self::StockAdjustment,
            self::ExpenseIncludedInValuation => true,
            default                          => false,
        };
    }

    /**
     * Peran yang boleh disuplai akun master lewat `PostingContext::$masterAccounts` (Requirement 3.1.1):
     * `cash_or_bank` (Metode Pembayaran) dan peran aset dari `AssetCategoryAccount`. Peran lain selalu lewat
     * aturan bersyarat/profil.
     */
    public function isMasterRole(): bool {
        return match ($this) {
            self::CashOrBank,
            self::FixedAsset,
            self::AccumulatedDepreciation,
            self::DepreciationExpense,
            self::CapitalWorkInProgress,
            self::GainLossDisposal => true,
            default                => false,
        };
    }

    public static function isMasterRoleValue(string $role): bool {
        return self::tryFrom($role)?->isMasterRole() ?? false;
    }

    /**
     * Apakah nilai string ini peran peka-barang; false untuk peran kustom yang tidak ada di enum.
     */
    public static function isLineSensitiveRole(self|string $role): bool {
        $enum = $role instanceof self ? $role : self::tryFrom($role);

        return $enum?->isLineSensitive() ?? false;
    }

    public function label(): string {
        return __("finances/postingRole.roles.{$this->value}");
    }

    /**
     * @return list<string>
     */
    public static function values(): array {
        return array_map(static fn (self $role): string => $role->value, self::cases());
    }
}

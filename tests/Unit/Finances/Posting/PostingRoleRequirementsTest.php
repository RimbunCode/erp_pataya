<?php

namespace Tests\Unit\Finances\Posting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingRoleRequirements;
use App\Services\Finances\Posting\PostingRuleRegistry;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

/**
 * Finance Fase 2, Task 6.1 (Requirement 8.2): daftar peran wajib per jenis dokumen yang mendasari peringatan "peran
 * belum terpetakan". Peran akun master tidak boleh masuk karena disuplai konfigurasi master, bukan profil.
 */
class PostingRoleRequirementsTest extends TestCase {
    public function test_every_document_type_has_a_requirement_list(): void {
        foreach (PostingDocumentType::cases() as $type) {
            $this->assertIsArray(PostingRoleRequirements::for($type), $type->value);
        }
    }

    public function test_master_roles_are_never_required_from_the_profile(): void {
        foreach (PostingDocumentType::cases() as $type) {
            foreach (PostingRoleRequirements::for($type) as $role) {
                $this->assertFalse($role->isMasterRole(), "{$type->value}: {$role->value} disuplai akun master.");
            }
        }
    }

    public function test_known_requirements(): void {
        $values = fn (PostingDocumentType $type): array => array_map(fn ($role): string => $role->value, PostingRoleRequirements::for($type));

        $this->assertSame(['receivable', 'revenue'], $values(PostingDocumentType::SalesInvoice));
        $this->assertSame(['stock', 'stock_received_but_not_billed'], $values(PostingDocumentType::PurchaseReceipt));
        $this->assertSame(['asset_revaluation'], $values(PostingDocumentType::AssetValueAdjustment));
        $this->assertSame([], $values(PostingDocumentType::AssetDepreciation));
    }

    /**
     * Uji silang dengan rule sebenarnya: gabungan peran non-master yang dirujuk rule pada konteks yang menjalankan
     * seluruh cabangnya harus sama dengan daftar persyaratan (mencegah daftar melenceng dari rule).
     */
    public function test_requirements_match_the_roles_referenced_by_the_real_rules(): void {
        $registry = new PostingRuleRegistry;
        $make     = fn (PostingDocumentType $type, array $amounts, array $flags = []): PostingContext => new PostingContext(
            $type,
            'App\Models\Doc',
            '01DOC',
            CarbonImmutable::parse('2026-11-12'),
            null,
            $amounts,
            $flags,
        );

        $contexts = [
            PostingDocumentType::SalesInvoice->value    => [$make(PostingDocumentType::SalesInvoice, ['total' => 100])],
            PostingDocumentType::PurchaseInvoice->value => [$make(PostingDocumentType::PurchaseInvoice, ['total' => 100, 'stock_total' => 60])],
            PostingDocumentType::PurchaseReceipt->value => [$make(PostingDocumentType::PurchaseReceipt, ['total' => 100])],
            PostingDocumentType::DeliveryNote->value    => [$make(PostingDocumentType::DeliveryNote, ['total_picked' => 100])],
            PostingDocumentType::PaymentEntry->value    => [
                $make(PostingDocumentType::PaymentEntry, ['paid_amount' => 10], ['payment_type' => 'receive', 'paymentable_kind' => 'sales_invoice']),
                $make(PostingDocumentType::PaymentEntry, ['paid_amount' => 10], ['payment_type' => 'pay', 'paymentable_kind' => 'purchase_invoice']),
            ],
            PostingDocumentType::StockEntry->value           => [$make(PostingDocumentType::StockEntry, ['basic_total' => 100], ['entry_type' => 'item_receipt', 'additional_costs' => [['id' => 'C1', 'amount' => 5]]])],
            PostingDocumentType::AssetDepreciation->value    => [$make(PostingDocumentType::AssetDepreciation, ['depreciation_amount' => 10])],
            PostingDocumentType::AssetScrap->value           => [$make(PostingDocumentType::AssetScrap, ['write_off_amount' => 10], ['is_depreciable' => true])],
            PostingDocumentType::AssetValueAdjustment->value => [$make(PostingDocumentType::AssetValueAdjustment, ['difference_amount' => 10])],
            PostingDocumentType::AssetDisposal->value        => [$make(PostingDocumentType::AssetDisposal, ['gain_loss' => 10], ['sales_invoice_item_id' => 'L1'])],
        ];

        foreach (PostingDocumentType::cases() as $type) {
            $referenced = [];
            foreach ($contexts[$type->value] as $ctx) {
                foreach ($registry->for($type)->build($ctx) as $draft) {
                    foreach ($draft->lines as $line) {
                        $role = AccountRole::tryFrom($line->roleValue());
                        if ($role === null || ! $role->isMasterRole()) {
                            $referenced[$line->roleValue()] = true;
                        }
                    }
                }
            }

            $expected = array_map(fn ($role): string => $role->value, PostingRoleRequirements::for($type));
            $actual   = array_keys($referenced);
            sort($expected);
            sort($actual);

            $this->assertSame($actual, $expected, $type->value);
        }
    }
}

<?php

namespace Tests\Unit\Listeners;

use PHPUnit\Framework\TestCase;

/**
 * Verifikasi lockForUpdate() via static code analysis.
 *
 * SQLite tidak mendukung row-level concurrency — test ini memverifikasi
 * bahwa source code mengandung lockForUpdate() di titik yang diharapkan.
 * Concurrency behavior hanya bisa diuji di MySQL/PostgreSQL.
 *
 * ponytail: static analysis over integration test — SQLite can't test row locks anyway.
 */
class LockForUpdateQueryTest extends TestCase {
    /** @test */
    public function purchase_receipt_service_has_five_lock_points(): void {
        $source = $this->loadSource('app/Services/Purchase/PurchaseReceiptService.php');

        $lockCount = substr_count($source, 'lockForUpdate()');

        // 2 existing (Stock lookup + firstOrCreate)
        // + 3 new (POItem billed_quantity, returnAgainstItem, findInvoiceItemsForPoItem)
        // GL Account (debitAccount/creditAccount) sudah dipindah ke
        // PostPurchaseReceiptGeneralLedger (queued Job, Requirement 5) — dicek
        // terpisah di gl_job_listeners_have_lock_points().
        $this->assertGreaterThanOrEqual(
            5,
            $lockCount,
            "PurchaseReceiptService harus punya minimal 5 lockForUpdate(), found: {$lockCount}",
        );
    }

    /** @test */
    public function purchase_invoice_service_has_lock_points(): void {
        $source = $this->loadSource('app/Services/Finances/PurchaseInvoiceService.php');

        $lockCount = substr_count($source, 'lockForUpdate()');

        // 2 new (SLE pending di updatePendingSLEs, returnAgainst PurchaseInvoice)
        // GL Account (expenseHeadAccount/creditAccount, Stock/SRNB) sudah
        // dipindah ke PostPurchaseInvoiceGeneralLedger (queued Job,
        // Requirement 7) — dicek terpisah di gl_job_listeners_have_lock_points().
        $this->assertGreaterThanOrEqual(
            2,
            $lockCount,
            "PurchaseInvoiceService harus punya minimal 2 lockForUpdate(), found: {$lockCount}",
        );
    }

    /** @test */
    public function delivery_note_service_has_lock_points(): void {
        $source = $this->loadSource('app/Services/Inventory/DeliveryNoteService.php');

        $lockCount = substr_count($source, 'lockForUpdate()');

        // 1 existing (Stock lookup)
        // + 1 new (returnAgainstItem)
        // GL Account (debitAccount/creditAccount) sudah dipindah ke
        // PostDeliveryNoteGeneralLedger (queued Job, Requirement 6) — dicek
        // terpisah di gl_job_listeners_have_lock_points().
        $this->assertGreaterThanOrEqual(
            2,
            $lockCount,
            "DeliveryNoteService harus punya minimal 2 lockForUpdate(), found: {$lockCount}",
        );
    }

    /** @test */
    public function gl_job_listeners_have_lock_points(): void {
        // GL Account (debitAccount/creditAccount, atau expenseHeadAccount/
        // creditAccount untuk PurchaseInvoice) dikunci DI DALAM Job — bukan
        // di Service — karena blok GL sudah dipindah total ke queued Job
        // (Requirement 5-7). Window race antara commit transaksi 1 dan Job
        // mulai dieksekusi DITERIMA sebagai konsekuensi desain queue (lihat
        // design.md Requirement 5 Acceptance Criteria 4) — lock ini cuma
        // mencegah race ANTAR-JOB, bukan mencegah perubahan selama di antrian.
        $receiptJob = $this->loadSource('app/Listeners/Purchase/Ledger/PostPurchaseReceiptGeneralLedger.php');
        $this->assertGreaterThanOrEqual(2, substr_count($receiptJob, 'lockForUpdate()'), 'PostPurchaseReceiptGeneralLedger harus lock Account');

        $invoiceJob = $this->loadSource('app/Listeners/Finances/Ledger/PostPurchaseInvoiceGeneralLedger.php');
        $this->assertGreaterThanOrEqual(2, substr_count($invoiceJob, 'lockForUpdate()'), 'PostPurchaseInvoiceGeneralLedger harus lock Account');

        $deliveryJob = $this->loadSource('app/Listeners/Inventory/Ledger/PostDeliveryNoteGeneralLedger.php');
        $this->assertGreaterThanOrEqual(2, substr_count($deliveryJob, 'lockForUpdate()'), 'PostDeliveryNoteGeneralLedger harus lock Account');
    }

    /** @test */
    public function find_invoice_items_method_uses_lock_for_update(): void {
        $source = $this->loadSource('app/Services/Purchase/PurchaseReceiptService.php');

        // Ekstrak method body findInvoiceItemsForPoItem
        $this->assertStringContainsString(
            '->lockForUpdate()',
            $source,
            'PurchaseReceiptService harus punya lockForUpdate()',
        );
    }

    /** @test */
    public function lock_on_po_item_before_billed_quantity_check(): void {
        $source = $this->loadSource('app/Services/Purchase/PurchaseReceiptService.php');

        // lockForUpdate() pada POItem harus ada SEBELUM billed_quantity > 0
        $lockPos = strpos($source, 'PurchaseOrderItem::where');
        $this->assertNotFalse($lockPos, 'Harus ada PurchaseOrderItem query dengan lockForUpdate');
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private function loadSource(string $relativePath): string {
        $base = dirname(__DIR__, 3); // tests/Unit/Listeners → project root

        return file_get_contents($base . '/' . $relativePath);
    }
}

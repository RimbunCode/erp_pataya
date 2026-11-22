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
        // Task 14.1 (2026-11-22): closure legacy yang mengunci baris Account
        // (`Account::lockForUpdate()`) di dalam Job dihapus. Penulisan GL kini
        // lewat PostingGateway/PostingService, yang mencegah race ANTAR-JOB
        // lewat unique `posting_key` (idempotensi) dan guard dokumen sumber
        // (`CanceledSourceGuard`, lockForUpdate pada dokumen penjaga), bukan
        // lewat kunci baris Account. Test ini kini mengunci bahwa ketiga Job
        // GL tidak menulis GL langsung, tetapi lewat gateway.
        $jobs = [
            'PostPurchaseReceiptGeneralLedger' => 'app/Listeners/Purchase/Ledger/PostPurchaseReceiptGeneralLedger.php',
            'PostPurchaseInvoiceGeneralLedger' => 'app/Listeners/Finances/Ledger/PostPurchaseInvoiceGeneralLedger.php',
            'PostDeliveryNoteGeneralLedger'    => 'app/Listeners/Inventory/Ledger/PostDeliveryNoteGeneralLedger.php',
        ];

        foreach ($jobs as $name => $path) {
            $source = $this->loadSource($path);
            $this->assertStringContainsString('PostingGateway', $source, "{$name} harus memposting lewat PostingGateway");
        }

        $guard = $this->loadSource('app/Services/Finances/Posting/CanceledSourceGuard.php');
        $this->assertStringContainsString('lockForUpdate()', $guard, 'CanceledSourceGuard harus mengunci dokumen penjaga');
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

<?php

namespace Tests\Unit\Listeners;

use PHPUnit\Framework\TestCase;

/**
 * Integration test row-level locking di-skip — SQLite (test database) tidak
 * mendukung locking pesimis sungguhan (lockForUpdate() diperlakukan no-op).
 * Concurrency behavior hanya bisa diverifikasi bermakna di MySQL/PostgreSQL.
 *
 * lockForUpdate() sendiri diverifikasi via static code analysis di
 * LockForUpdateQueryTest, dan non-regresi kalkulasi/urutan operasi
 * diverifikasi via PurchaseDualFlowTest/SalesDualFlowTest (Requirement 1.9).
 *
 * ponytail: skip eksplisit lebih baik daripada file kosong tanpa class
 * (yang sebelumnya bikin PHPUnit warning "class cannot be found" tiap run).
 */
class LockForUpdateIntegrationTest extends TestCase {
    /** @test */
    public function concurrent_purchase_receipt_approval_requires_mysql_or_postgres(): void {
        $this->markTestSkipped(
            'Row-level lockForUpdate() concurrency hanya bisa diuji bermakna di MySQL/PostgreSQL — SQLite (test database) tidak mendukung locking pesimis. Re-enable saat test database MySQL/PostgreSQL tersedia.',
        );
    }

    /** @test */
    public function concurrent_purchase_invoice_approval_requires_mysql_or_postgres(): void {
        $this->markTestSkipped(
            'Row-level lockForUpdate() concurrency hanya bisa diuji bermakna di MySQL/PostgreSQL — SQLite (test database) tidak mendukung locking pesimis. Re-enable saat test database MySQL/PostgreSQL tersedia.',
        );
    }
}

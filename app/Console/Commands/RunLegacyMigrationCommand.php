<?php

namespace App\Console\Commands;

use App\Services\Migration\BaseMigrator;
use App\Services\Migration\Migrators\Core\Connections\ModelConnectionMigrator;
use App\Services\Migration\Migrators\Finances\SalesInvoices\SalesInvoiceItemMigrator;
use App\Services\Migration\Migrators\Finances\SalesInvoices\SalesInvoiceMigrator;
use App\Services\Migration\Migrators\Inventory\Categories\CategoryMigrator;
use App\Services\Migration\Migrators\Inventory\DeliveryItem\DeliveryNoteItemMigrator;
use App\Services\Migration\Migrators\Inventory\DeliveryItem\DeliveryNoteMigrator;
use App\Services\Migration\Migrators\Inventory\Items\ItemMigrator;
use App\Services\Migration\Migrators\Inventory\Units\UnitMigrator;
use App\Services\Migration\Migrators\Inventory\Warehouses\WarehouseMigrator;
use App\Services\Migration\Migrators\Purchase\Orders\PurchaseOrderItemMigrator;
use App\Services\Migration\Migrators\Purchase\Orders\PurchaseOrderMigrator;
use App\Services\Migration\Migrators\Purchase\Receipts\PurchaseReceiptItemMigrator;
use App\Services\Migration\Migrators\Purchase\Receipts\PurchaseReceiptMigrator;
use App\Services\Migration\Migrators\Purchase\Requests\PurchaseRequestItemMigrator;
use App\Services\Migration\Migrators\Purchase\Requests\PurchaseRequestMigrator;
use App\Services\Migration\Migrators\Purchase\Suppliers\SupplierMigrator;
use App\Services\Migration\Migrators\Sales\Customers\CustomerMigrator;
use App\Services\Migration\Migrators\Sales\InternalOrders\InternalOrderItemMigrator;
use App\Services\Migration\Migrators\Sales\InternalOrders\InternalOrderMigrator;
use App\Services\Migration\Migrators\Sales\Orders\SalesOrderItemMigrator;
use App\Services\Migration\Migrators\Sales\Orders\SalesOrderMigrator;
use App\Services\Migration\Migrators\Service\WorkOrders\WorkOrderItemMigrator;
use App\Services\Migration\Migrators\Service\WorkOrders\WorkOrderMigrator;
use App\Services\Migration\Migrators\User\Authentication\UserMigrator;
use Illuminate\Console\Command;
use Throwable;

class RunLegacyMigrationCommand extends Command {
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'erp:migrate-legacy {--step= : Menjalankan migrator pada urutan tertentu saja (dimulai dari 0)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Menjalankan semua script migrasi legacy sesuai urutan yang ditentukan';

    /**
     * DAFTAR DAN URUTAN MIGRATOR.
     * Tentukan urutan eksekusi kelas migrator di sini.
     * Tabel Induk/Master harus berada di atas tabel Anak/Transaksi.
     *
     * @var array<int, class-string>
     */
    protected array $migrators = [
        // === TAHAP 1: MASTER DATA UTAMA (Tanpa Relasi) ===
        UserMigrator::class,
        UnitMigrator::class,
        CategoryMigrator::class,
        WarehouseMigrator::class,
        CustomerMigrator::class,
        SupplierMigrator::class,
        ItemMigrator::class,

        // === TAHAP 2: MASTER DATA TURUNAN (Bergantung ke Tahap 1) ===
        WorkOrderMigrator::class,
        WorkOrderItemMigrator::class,
        InternalOrderMigrator::class,
        InternalOrderItemMigrator::class,
        PurchaseRequestMigrator::class,
        PurchaseRequestItemMigrator::class,

        // === TAHAP 3: TRANSAKSI (Bergantung ke Master Data) ===
        SalesOrderMigrator::class,
        SalesOrderItemMigrator::class,
        PurchaseOrderMigrator::class,
        PurchaseOrderItemMigrator::class,
        DeliveryNoteMigrator::class,
        DeliveryNoteItemMigrator::class,
        PurchaseReceiptMigrator::class,
        PurchaseReceiptItemMigrator::class,
        SalesInvoiceMigrator::class,
        SalesInvoiceItemMigrator::class,

        // === TAHAP 4: KONEKSI ANTAR DOKUMEN (Setelah seluruh dokumen tersedia) ===
        ModelConnectionMigrator::class,
    ];

    /**
     * Execute the console command.
     */
    public function handle(): int {
        $this->info('Memulai proses migrasi data legacy...');
        $this->info('Total skenario migrasi: ' . count($this->migrators));

        $stepOption = $this->option('step');

        if ($stepOption !== null) {
            if (! ctype_digit((string) $stepOption)) {
                $this->error('Nilai --step harus berupa angka non-negatif (dimulai dari 0).');

                return self::FAILURE;
            }

            $step = (int) $stepOption;
            if (! isset($this->migrators[$step])) {
                $this->error("Langkah ke-{$step} tidak ditemukan di array migrators.");

                return self::FAILURE;
            }

            return $this->runMigrator($this->migrators[$step], $step);
        }

        if ($this->migrators === []) {
            $this->warn('Belum ada migrator yang terdaftar. Tambahkan kelas migrator pada properti $migrators.');

            return self::SUCCESS;
        }

        foreach ($this->migrators as $index => $migratorClass) {
            if ($this->runMigrator($migratorClass, $index) === self::FAILURE) {
                return self::FAILURE;
            }
        }

        $this->newLine();
        $this->info('Semua proses migrasi selesai!');

        return self::SUCCESS;
    }

    /**
     * Instansiasi dan jalankan migrator
     */
    protected function runMigrator(string $class, int $index): int {
        $this->newLine();
        $this->warn('[' . ($index + 1) . '/' . count($this->migrators) . "] Menyiapkan: {$class}...");

        if (! is_subclass_of($class, BaseMigrator::class)) {
            $this->error("Kelas {$class} harus turunan dari " . BaseMigrator::class . '.');

            return self::FAILURE;
        }

        try {
            /** @var BaseMigrator $migrator */
            $migrator = app($class);
            $migrator->migrate();
            $this->info("Selesai: {$class}");
        } catch (Throwable $exception) {
            $this->error("Gagal menjalankan {$class}: {$exception->getMessage()}");
            report($exception);

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}

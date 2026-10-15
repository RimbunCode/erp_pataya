<?php

namespace Tests\Unit\Services\Report\StockMutation;

use App\Models\Finances\PurchaseInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\StockEntry;
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Report\StockMutation\TransactionTypeLabeler;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TransactionTypeLabelerTest extends TestCase {
    private TransactionTypeLabeler $labeler;

    protected function setUp(): void {
        parent::setUp();

        app()->setLocale('id');
        $this->labeler = new TransactionTypeLabeler;
    }

    #[Test]
    public function fqcn_yang_dikenal_menghasilkan_label_terjemahan(): void {
        $this->assertSame('Penerimaan Pembelian', $this->labeler->label(PurchaseReceipt::class));
        $this->assertSame('Delivery Note', $this->labeler->label(DeliveryNote::class));
        $this->assertSame('Stock Entry', $this->labeler->label(StockEntry::class));
        $this->assertSame('Invoice Pembelian (penyesuaian nilai)', $this->labeler->label(PurchaseInvoice::class));
    }

    #[Test]
    public function fqcn_asing_jatuh_ke_nama_kelas_pendek(): void {
        $this->assertSame('AssetDepreciationSchedule', $this->labeler->label('App\\Models\\Asset\\AssetDepreciationSchedule'));
    }

    #[Test]
    public function referenceable_type_kosong_menghasilkan_label_tidak_diketahui(): void {
        $this->assertSame('Tidak diketahui', $this->labeler->label(null));
        $this->assertSame('Tidak diketahui', $this->labeler->label(''));
    }
}

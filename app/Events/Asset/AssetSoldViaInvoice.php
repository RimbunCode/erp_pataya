<?php

namespace App\Events\Asset;

use App\Models\Finances\SalesInvoiceItem;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Baris Sales Invoice berisi aset disetujui. `$invoiceDate` adalah waktu approve Sales Invoice (sama dengan tanggal posting
 * jurnal Sales Invoice) yang dibawa agar bentuk jurnal pelepasan (diskon terpisah) mengikuti jurnal Sales Invoice walau job
 * berjalan di hari lain; null berarti memakai waktu job.
 */
class AssetSoldViaInvoice {
    use Dispatchable;

    public function __construct(
        public readonly SalesInvoiceItem $line,
        public readonly ?CarbonInterface $invoiceDate = null,
    ) {}
}

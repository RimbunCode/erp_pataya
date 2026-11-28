<?php

namespace App\Models\Finances;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu baris pajak sebuah item Sales Invoice (pajak majemuk per item, spek finance-multi-tax-per-item).
 * Pasangan (item, pajak) menyimpan versi aturan, tarif, faktor DPP, basis, DPP, dan jumlah pajak/potongan hasil
 * `TaxEngine`. `position` 0 adalah Pajak Utama (dicerminkan ke kolom item `tax_id`). Hanya
 * `InvoiceItemTaxCalculator` yang menulis baris ini; nilainya tidak pernah datang dari request.
 */
class SalesInvoiceItemTax extends Model {
    use HasUlids;

    protected $table   = 'sales_invoice_item_taxes';
    protected $guarded = ['id'];
    protected $casts   = [
        'position'           => 'integer',
        'tax_rate'           => 'float',
        'dpp_factor'         => 'float',
        'base_amount'        => 'float',
        'dpp_amount'         => 'float',
        'tax_amount'         => 'float',
        'withholding_amount' => 'float',
    ];

    public function item(): BelongsTo {
        return $this->belongsTo(SalesInvoiceItem::class, 'sales_invoice_item_id');
    }

    public function tax(): BelongsTo {
        return $this->belongsTo(Tax::class)->withTrashed();
    }

    public function ruleVersion(): BelongsTo {
        return $this->belongsTo(TaxRuleVersion::class, 'tax_rule_version_id');
    }
}

<?php

namespace App\Models\CRM;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Blok teks bebas pada surat Quotation (Terms & Conditions, Note, Term of
 * Payment, dst). Isi disalin dari QuotationSectionTemplate lalu menjadi milik
 * dokumen.
 */
class QuotationSection extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation = 'quotation';
    public string $translateKey   = 'crm.quotation.section';
    protected $guarded            = ['id'];
    protected $casts              = [
        'order' => 'integer',
    ];
    protected array $configColumns = [
        'title' => [
            'show'  => true,
            'order' => 0,
        ],
        'content' => [
            'show'  => true,
            'order' => 1,
        ],
        'order' => [
            'show'  => false,
            'order' => 2,
        ],
    ];

    public static function templateLink() {
        return ':title';
    }

    public function quotation() {
        return $this->belongsTo(Quotation::class);
    }
}

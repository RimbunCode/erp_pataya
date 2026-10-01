<?php

namespace App\Models\CRM;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Master template blok teks Quotation. Isinya DISALIN ke QuotationSection saat
 * dipakai, bukan direferensikan (pola P3 pada spec quotation-letter-fields).
 * `quotation_type` null berarti template berlaku untuk semua jenis.
 */
class QuotationSectionTemplate extends Model {
    use DataTable, HasUlids, SoftDeletes;

    public string $translateKey = 'crm.quotation_section_template';
    protected $guarded          = ['id'];
    protected $casts            = [
        'order' => 'integer',
    ];

    public static function templateLink() {
        return ':name';
    }

    protected array $configColumns = [
        'name' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'quotation_type' => [
            'show'  => true,
            'order' => 1,
        ],
        'title' => [
            'show'  => true,
            'order' => 2,
        ],
        'content' => [
            'show'  => false,
            'order' => 3,
        ],
        'order' => [
            'show'  => false,
            'order' => 4,
        ],
    ];
}

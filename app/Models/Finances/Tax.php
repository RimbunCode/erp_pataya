<?php

namespace App\Models\Finances;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tax extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    public static function templateLink() {
        return ':name (:rate%)';
    }

    protected array $configColumns = [
        'name' => [
            'show'   => true,
            'isLink' => true,
        ],
        'rate' => [
            'type' => 'numeric',
            'show' => true,
        ],
    ];
    public string $translateKey = 'finances.taxes';
}

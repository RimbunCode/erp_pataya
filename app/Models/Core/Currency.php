<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Currency extends Model {
    use DataTable, HasFactory;

    protected $primaryKey          = 'code';
    public $incrementing           = false;
    protected $keyType             = 'string';
    protected $guarded             = [];
    public $translateKey           = 'core.currency';
    protected array $configColumns = [
        'code'          => ['show' => true, 'order' => 0, 'isLink' => true],
        'name'          => ['show' => true, 'order' => 1],
        'symbol'        => ['show' => true, 'order' => 2],
        'number_format' => ['show' => false, 'order' => 3],
    ];

    public static function templateLink() {
        return ':name (:code)';
    }

    public static function convertMoney(float $amount, float $exchangeRate = 1) {
        return $amount * $exchangeRate;
    }
}

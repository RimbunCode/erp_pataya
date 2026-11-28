<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Currency extends Model {
    use DataTable, HasFactory;

    public string $formComponent   = 'Settings/Currencies/Form';
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

    /**
     * @deprecated Hanya perkalian tanpa kurs bertipe, pembulatan minor unit, atau jejak kurs. Kode baru memakai
     *             `App\Services\Finances\Currency\FxEngine::convert()` (Finance Fase 4, Requirement 2.6).
     */
    public static function convertMoney(float $amount, float $exchangeRate = 1) {
        return $amount * $exchangeRate;
    }
}

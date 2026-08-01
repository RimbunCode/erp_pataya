<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Country extends Model {
    use DataTable, HasFactory;

    public string $formComponent   = 'Settings/Countries/Form';
    protected $primaryKey          = 'code';
    public $incrementing           = false;
    protected $keyType             = 'string';
    protected $guarded             = [];
    public $translateKey           = 'core.country';
    protected array $configColumns = [
        'code'      => ['show' => true, 'order' => 0, 'isLink' => true],
        'name'      => ['show' => true, 'order' => 1],
        'lang_code' => ['show' => true, 'order' => 2],
        'url_flag'  => ['show' => false, 'order' => 3],
        'timezones' => ['show' => false, 'order' => 4],
    ];

    protected function casts(): array {
        return ['timezones' => 'array'];
    }

    public static function templateLink() {
        return ':name';
    }
}

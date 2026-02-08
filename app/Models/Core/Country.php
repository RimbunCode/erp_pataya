<?php

namespace App\Models\Core;

use App\Models\Model;

class Country extends Model
{
    protected $primaryKey = 'code';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    public $translateKey = 'core.country';

    protected $configColumns = [
        'code' => [
            'show' => true,
            'order' => 0,
        ],
        'name' => [
            'show' => true,
            'order' => 1,
        ],
    ];

    public static function templateLink()
    {
        return ':name';
    }
}

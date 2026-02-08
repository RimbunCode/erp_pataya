<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Traits\DataTable;

class Preference extends Model
{
    use DataTable;

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $casts = [
        'value' => \App\Casts\Json::class,
    ];

    public $translateKey = 'core.preference';

    protected $configColumns = [
        'value' => [
            'show' => true,
        ],
    ];
}

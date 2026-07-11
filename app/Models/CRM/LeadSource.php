<?php

namespace App\Models\CRM;

use App\Models\Model;

class LeadSource extends Model {
    protected $primaryKey    = 'code';
    public $incrementing     = false;
    protected $keyType       = 'string';
    protected $guarded       = [];
    public $translateKey     = 'crm.lead_source';
    protected $configColumns = [
        'code' => [
            'show'  => true,
            'order' => 0,
        ],
        'name' => [
            'show'  => true,
            'order' => 1,
        ],
    ];

    public static function templateLink() {
        return ':name';
    }
}

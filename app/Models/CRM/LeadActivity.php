<?php

namespace App\Models\CRM;

use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class LeadActivity extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'scheduled_at' => 'datetime',
    ];

    public static function templateLink() {
        return ':subject';
    }

    public $translateKey     = 'crm.lead_activity';
    protected $configColumns = [
        'type' => [
            'show'  => true,
            'order' => 0,
        ],
        'subject' => [
            'show'  => true,
            'order' => 1,
        ],
        'scheduled_at' => [
            'show'  => true,
            'order' => 2,
        ],
        'status' => [
            'show'  => true,
            'order' => 3,
        ],
        'assignedTo' => [
            'show'  => true,
            'order' => 4,
        ],
        'lead',
    ];

    protected static function loadRelationsOnShow() {
        return ['assignedTo'];
    }

    public function lead() {
        return $this->belongsTo(Lead::class);
    }

    public function assignedTo() {
        return $this->belongsTo(User::class, 'assigned_to_id');
    }
}

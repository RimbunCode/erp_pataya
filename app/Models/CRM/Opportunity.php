<?php

namespace App\Models\CRM;

use App\Models\Model;
use App\Models\Sales\Customer;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Opportunity extends Model {
    use DataTable, HasUlids, SoftDeletes;

    public string $formComponent = 'CRM/Opportunities/Form';
    protected $guarded           = ['id'];
    protected $casts             = [
        'expected_value'      => 'float',
        'probability'         => 'integer',
        'expected_close_date' => 'date',
    ];

    public static function templateLink() {
        return ':title';
    }

    public $translateKey     = 'crm.opportunity';
    protected $configColumns = [
        'title' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'customer' => [
            'show'  => true,
            'order' => 1,
        ],
        'stage' => [
            'show'  => true,
            'order' => 2,
        ],
        'expected_value' => [
            'show'  => true,
            'order' => 3,
        ],
        'probability' => [
            'show'  => true,
            'order' => 4,
        ],
        'expected_close_date' => [
            'show'  => true,
            'order' => 5,
        ],
        'assignedTo' => [
            'show'  => true,
            'order' => 6,
        ],
        'lead',
    ];

    protected static function loadRelationsOnShow() {
        return ['lead', 'customer', 'assignedTo', 'quotations'];
    }

    public function lead() {
        return $this->belongsTo(Lead::class);
    }

    public function customer() {
        return $this->belongsTo(Customer::class);
    }

    public function assignedTo() {
        return $this->belongsTo(User::class, 'assigned_to_id');
    }

    public function quotations() {
        return $this->hasMany(Quotation::class);
    }
}

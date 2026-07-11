<?php

namespace App\Models\CRM;

use App\Models\Core\Country;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lead extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    public static function templateLink() {
        return ':company_name';
    }

    public $translateKey     = 'crm.lead';
    protected $configColumns = [
        'company_name' => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'contact_name' => [
            'show'  => true,
            'order' => 1,
        ],
        'email' => [
            'show'  => true,
            'order' => 2,
        ],
        'phone' => [
            'show'  => true,
            'order' => 3,
        ],
        'status' => [
            'show'  => true,
            'order' => 4,
        ],
        'leadSource' => [
            'show'  => true,
            'order' => 5,
        ],
        'assignedTo' => [
            'show'  => true,
            'order' => 6,
        ],
        'country',
    ];

    protected static function loadRelationsOnShow() {
        return ['leadSource', 'assignedTo', 'country', 'convertedCustomer'];
    }

    public function leadSource() {
        return $this->belongsTo(LeadSource::class, 'lead_source_id', 'code');
    }

    public function assignedTo() {
        return $this->belongsTo(User::class, 'assigned_to_id');
    }

    public function country() {
        return $this->belongsTo(Country::class, 'country_id', 'code');
    }

    public function convertedCustomer() {
        return $this->belongsTo(Customer::class, 'converted_customer_id');
    }
}

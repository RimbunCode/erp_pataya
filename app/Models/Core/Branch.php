<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model {
    use DataTable, HasUlids, SoftDeletes;
    protected $guarded = ['id'];
    protected $casts   = [
        'is_main_branch' => 'boolean',
        'is_disabled'    => 'boolean',
    ];
    protected $appends = [
        'title',
        'shippingAddress',
        'billingAddress',
    ];
    protected $with    = [
        'billingCountry',
        'shippingCountry',
    ];

    public function getShippingAddressAttribute() {
        return "{$this->shipping_street}, {$this->shipping_city}, {$this->shipping_province}, {$this->shippingCountry?->name} {$this->shipping_zip_code}";
    }

    public function getBillingAddressAttribute() {
        return "{$this->billing_street}, {$this->billing_city}, {$this->billing_province}, {$this->billingCountry?->name} {$this->billing_zip_code}";
    }

    public function title(): Attribute {
        return new Attribute(
            get: function ($value) {
                if ($this->is_main_branch) {
                    $main = __('core/branch.main');

                    return "{$this->name} ({$main})";
                }

                return $this->name;
            },
        );
    }

    public static function boot() {
        parent::boot();
        static::addGlobalScope('country', function (Builder $builder) {
            $builder->with(['billingCountry', 'shippingCountry']);
        });
    }

    public static function templateLink() {
        return ':name{:title}';
    }

    protected static function loadRelationsOnShow() {
        return ['shippingCountry', 'billingCountry'];
    }
    public string   $formComponent = 'Settings/Branches/Form';
    public string   $translateKey  = 'core.branch';
    protected array $configColumns = [
        'title'           => [
            'isLink' => true,
            'show'   => true,
            'order'  => 0,
        ],
        'is_main_branch'  => [
            'show'  => true,
            'order' => 1,
        ],
        'shippingAddress' => [
            'show'  => true,
            'order' => 2,
        ],
        'billingAdrress'  => [
            'show'  => true,
            'order' => 3,
        ],
        'billingCountry',
        'shippingCountry',
        'branchable',
    ];

    public function billingCountry() {
        return $this->belongsTo(Country::class, 'billing_country_id', 'code');
    }

    public function shippingCountry() {
        return $this->belongsTo(Country::class, 'shipping_country_id', 'code');
    }

    public function users() {
        return $this->belongsToMany(User::class, 'user_branches', 'branch_id', 'user_id');
    }

    public function branchable() {
        return $this->morphTo();
    }
}

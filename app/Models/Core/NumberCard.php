<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\DashboardWidget;
use App\Models\Model;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Traits\DataTable;
use App\Traits\Shareable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class NumberCard extends Model {
    use DataTable, HasUlids, Shareable, SoftDeletes;

    public string $formComponent = 'Settings/NumberCard/Form';
    protected $guarded           = ['id'];
    public $casts                = [
        'filters'               => Json::class,
        'description'           => Json::class,
        'is_shared_all'         => 'boolean',
        'show_full_number'      => 'boolean',
        'show_percentage_stats' => 'boolean',
    ];
    public $translateKey = 'settings.number_card';

    public static function templateLink() {
        return ':label';
    }

    public $appends = ['translateModelKey'];

    protected function getTranslateModelKeyAttribute() {
        if (! $this->model_class) {
            return null;
        }
        $model = new $this->model_class;

        return $model->translateKey;
    }

    protected static function loadRelationsOnShow() {
        return ['createdBy', 'model', 'assignables'];
    }

    protected array $configColumns = [
        'translateModelKey' => [
            'dependsOn' => ['model_class'],
        ],
        'label' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        // Feedback user: NumberCardBlock/NumberCardDisplay butuh field ini di
        // luar templateLink (":label") — linkable + diminta eksplisit lewat
        // NumberCardLinkModel's `fields` prop (lihat safeLookupColumns()).
        'icon' => [
            'linkable' => true,
        ],
        'description' => [
            'linkable' => true,
        ],
        'filters' => [
            'linkable' => true,
        ],
        'function' => [
            'show'       => true,
            'order'      => 1,
            'valueTrans' => 'settings.number_card.functions',
        ],
        'model' => [
            'show'               => true,
            'order'              => 2,
            'disabledNavigation' => true,
        ],
        'createdBy' => [
            'show'  => true,
            'order' => 3,
        ],
        'created_at' => [
            'show'  => true,
            'order' => 4,
        ],
        'source_type' => [
            'valueTrans' => 'settings.number_card.source_types',
        ],
        'stats_time_interval' => [
            'valueTrans' => 'settings.number_card.stats_time_intervals',
        ],
    ];

    public function model() {
        return $this->belongsTo(Permission::class, 'model_id');
    }

    public function createdBy() {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function dashboardWidgets(): HasMany {
        return $this->hasMany(DashboardWidget::class, 'number_card_id');
    }

    protected function assignablePivot(): string {
        return NumberCardAssignable::class;
    }
}

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

class Chart extends Model {
    use DataTable, HasUlids, Shareable, SoftDeletes;

    public string $formComponent = 'Settings/Chart/Form';
    protected $guarded           = ['id'];
    public $casts                = [
        'filters'                => Json::class,
        'custom_options'         => Json::class,
        'description'            => Json::class,
        'is_shared_all'          => 'boolean',
        'timeseries'             => 'boolean',
        'show_values_over_chart' => 'boolean',
        'show_full_number'       => 'boolean',
    ];
    public $translateKey = 'settings.chart';

    public static function templateLink() {
        return ':chart_name';
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
        'chart_name' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        // Feedback user: ChartBlock/ChartDisplay butuh field ini di luar
        // templateLink (":chart_name") — linkable + diminta eksplisit lewat
        // ChartLinkModel's `fields` prop (lihat safeLookupColumns()).
        'icon' => [
            'linkable' => true,
        ],
        'description' => [
            'linkable' => true,
        ],
        'filters' => [
            'linkable' => true,
        ],
        'chart_source_type' => [
            'show'       => true,
            'order'      => 1,
            'valueTrans' => 'settings.chart.chart_source_types',
        ],
        'visual_type' => [
            'show'       => true,
            'order'      => 2,
            'valueTrans' => 'settings.chart.visual_types',
        ],
        'model' => [
            'show'               => true,
            'order'              => 3,
            'disabledNavigation' => true,
        ],
        'createdBy' => [
            'show'  => true,
            'order' => 4,
        ],
        'created_at' => [
            'show'  => true,
            'order' => 5,
        ],
        'group_by_type' => [
            'valueTrans' => 'settings.chart.group_by_types',
        ],
        'time_interval' => [
            'valueTrans' => 'settings.chart.time_intervals',
        ],
        'timespan' => [
            'valueTrans' => 'settings.chart.timespans',
        ],
    ];

    public function model() {
        return $this->belongsTo(Permission::class, 'model_id');
    }

    public function createdBy() {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function dashboardWidgets(): HasMany {
        return $this->hasMany(DashboardWidget::class, 'chart_id');
    }

    protected function assignablePivot(): string {
        return ChartAssignable::class;
    }
}

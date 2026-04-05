<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\DashboardWidget;
use App\Models\Model;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Widget extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    public $casts      = [
        'config' => Json::class,
    ];
    public $translateKey = 'settings.widget';

    public static function templateLink() {
        return ':title';
    }

    protected function getTranslateModelKeyAttribute() {
        $model = new $this->model_class;

        return $model->translateKey;
    }

    protected static function loadRelationsOnShow() {
        return ['dashboards', 'createdBy', 'model'];
    }

    protected $configColumns = [
        'title' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'type' => [
            'show'       => true,
            'order'      => 1,
            'valueTrans' => 'settings.widget.types',
        ],
        'model' => [
            'show'               => true,
            'order'              => 2,
            'disabledNavigation' => true,
        ],
        'created_by' => [
            'show'  => true,
            'order' => 3,
        ],
        'dashboard' => [
            'show'  => true,
            'order' => 4,
        ],
        'created_at' => [
            'show'  => true,
            'order' => 5,
        ],
        'group_by_types' => [
            'valueTrans' => 'settings.widget.columns.group_by_types.options',
        ],
        'calculation_type' => [
            'valueTrans' => 'settings.widget.calculation_types',
        ],
        'time_interval' => [
            'valueTrans' => 'settings.widget.time_intervals',
        ],
        'group_by_base_on' => [
            'valueTrans' => 'settings.widget.group_by_base_on.types',
        ],
        'timespan' => [
            'valueTrans' => 'settings.widget.timespans',
        ],
    ];

    public function dashboards() {
        return $this->hasMany(DashboardWidget::class, 'widget_id');
    }

    public function createdBy() {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function model() {
        return $this->belongsTo(Permission::class, 'model_id');
    }
}

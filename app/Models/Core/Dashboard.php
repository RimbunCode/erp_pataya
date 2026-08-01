<?php

namespace App\Models\Core;

use App\Models\DashboardWidget;
use App\Models\Model;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Dashboard extends Model {
    use DataTable, HasUlids, SoftDeletes;
    //

    protected $guarded           = ['id'];
    public $translateKey         = 'settings.dashboard';
    public string $keyBreadcrumb = 'title';
    public string $formComponent = 'Settings/Dashboard/Form';

    public static function templateLink() {
        return ':title';
    }

    protected static function loadRelationsOnShow() {
        return ['widgets', 'widgets.widget', 'createdBy'];
    }

    protected array $configColumns = [
        'title' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'createdBy' => [
            'show'  => true,
            'order' => 1,
        ],
    ];

    public function widgets() {
        return $this->hasMany(DashboardWidget::class, 'dashboard_id')
            ->orderBy('order');
    }

    public function createdBy() {
        return $this->belongsTo(User::class, 'created_by_id');
    }
}

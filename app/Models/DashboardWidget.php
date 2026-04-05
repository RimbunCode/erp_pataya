<?php

namespace App\Models;

use App\Casts\Json;
use App\Models\Core\Dashboard;
use App\Models\Core\Widget;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class DashboardWidget extends Model
{
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    public $translateKey = 'settings.dashboard';

    public $casts = [
        'config' => Json::class,
        'is_visible' => 'boolean',
    ];

    protected static function loadRelationsOnShow()
    {
        return ['widget', 'dashboard', 'parent'];
    }

    protected $configColumns = [
        'widget',
        'dashboard',
        'parent',
    ];

    public function widget()
    {
        return $this->belongsTo(Widget::class, 'widget_id');
    }

    public function dashboard()
    {
        return $this->belongsTo(Dashboard::class, 'dashboard_id');
    }

    public function parent()
    {
        return $this->belongsTo(DashboardWidget::class, 'parent_id');
    }
}

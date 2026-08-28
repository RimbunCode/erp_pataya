<?php

namespace App\Models;

use App\Casts\Json;
use App\Models\Core\Dashboard;
use App\Models\Core\Widget;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class DashboardWidget extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded   = ['id'];
    public $translateKey = 'settings.dashboard';
    public $casts        = [
        'config'     => Json::class,
        'is_visible' => 'boolean',
    ];

    public const TYPES_WITH_WIDGET = ['chart', 'card'];

    /**
     * Peta type -> daftar type parent yang valid untuk parent_id-nya
     * (desk-dashboard-builder Requirement 1.7-1.10). `null` di dalam array
     * berarti root (parent_id kosong) diperbolehkan. section: HANYA root
     * (array cuma berisi null, tidak ada tipe parent lain) — bukan array
     * kosong, karena array kosong berarti TIDAK ADA nilai parent_id yang
     * valid sama sekali (termasuk root), yang salah untuk section.
     */
    public const VALID_PARENTS = [
        'section'        => [null],
        'link_card'      => [null, 'section'],
        'link_card_item' => ['link_card'],
        'chart'          => [null, 'section'],
        'card'           => [null, 'section'],
        'text'           => [null, 'section'],
        'spacer'         => [null, 'section'],
        'shortcut'       => [null, 'section'],
        'quick_list'     => [null, 'section'],
    ];

    protected static function loadRelationsOnShow() {
        return ['widget', 'dashboard', 'parent'];
    }

    protected array $configColumns = [
        'widget',
        'dashboard',
        'parent',
    ];

    public function widget() {
        return $this->belongsTo(Widget::class, 'widget_id');
    }

    public function dashboard() {
        return $this->belongsTo(Dashboard::class, 'dashboard_id');
    }

    public function parent() {
        return $this->belongsTo(DashboardWidget::class, 'parent_id');
    }

    public function children(): HasMany {
        return $this->hasMany(DashboardWidget::class, 'parent_id')->orderBy('order');
    }
}

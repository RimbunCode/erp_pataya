<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use App\Models\User\Permission;
use App\Traits\DataTable;
use App\Utils;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class PrintTemplate extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'template'             => Json::class,
        'is_default'           => 'boolean',
        'is_letter_head'       => 'boolean',
        'show_absolute_values' => 'boolean',
    ];
    protected $appends           = ['title', 'columns'];
    public string $keyBreadcrumb = 'name';
    public string $translateKey  = 'core.printTemplate';

    public static function templateLink() {
        return ':name';
    }

    public function title(): Attribute {
        return new Attribute(
            get: function () {
                $model = $this->model;
                if ($model == null) {
                    return '';
                }
                $modelInstance = new $model;

                return "{$modelInstance->translateKey}.title";
            },
        );
    }

    public function columns(): Attribute {
        return new Attribute(
            get: function () {
                if ($this->model) {
                    $instance = new $this->model;
                    $columns  = [
                        [
                            'name'    => 'company_details',
                            'title'   => trans('core/company.company_details.title'),
                            'type'    => 'preferences',
                            'columns' => Utils::getPreferenceColumns(),
                        ], [
                            'name'       => Str::lower(Str::snake(Str::singular($this->name_model))),
                            'type'       => 'data',
                            'titleTrans' => isset($instance) ? $instance->translateKey . '.title' : Str::singular($this->name_model),
                            'columns'    => $this->model::getColumns(1),
                        ],
                    ];
                }

                return $this->model != null ? $columns : Utils::getPreferenceColumns();
            },
        );
    }

    public $configColumns = [
        'name' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'name_model' => [
            'show'  => true,
            'order' => 1,
        ],
        'is_default' => [
            'show'  => true,
            'order' => 2,
        ],
        'permission_id' => [
            'ignore' => true,
        ],
        'model' => [
            'ignore' => true,
        ],
    ];

    public static function boot() {
        parent::boot();

        self::saving(function (self $model) {
            if ($model->is_default) {
                return;
            }

            if ($model->exists && ! $model->isDirty(['is_default', 'model'])) {
                return;
            }

            $hasOtherTemplate = PrintTemplate::where('model', $model->model)
                ->when($model->exists, function ($query) use ($model) {
                    $query->whereKeyNot($model->id);
                })
                ->exists();

            if (! $hasOtherTemplate) {
                $model->is_default = true;
            }
        });

        self::saved(function (self $model) {
            if (! $model->is_default) {
                return;
            }

            if (! $model->wasRecentlyCreated && ! $model->wasChanged(['is_default', 'model'])) {
                return;
            }

            PrintTemplate::where('model', $model->model)
                ->whereKeyNot($model->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        });
    }

    protected static function loadRelationsOnShow() {
        return ['permission', 'letterHead'];
    }

    public function permission() {
        return $this->belongsTo(Permission::class);
    }

    public function letterHead() {
        return $this->belongsTo(PrintTemplate::class, 'letter_head_id');
    }
}

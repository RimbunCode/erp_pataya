<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use App\Models\User\Permission;
use App\Services\Core\PrintTemplate\RelationTrackerService;
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
        'used_relations'       => 'array',
        'is_default'           => 'boolean',
        'is_letter_head'       => 'boolean',
        'show_absolute_values' => 'boolean',
        'width'                => 'float',
        'height'               => 'float',
        'margin_top'           => 'float',
        'margin_bottom'        => 'float',
        'margin_left'          => 'float',
        'margin_right'         => 'float',
    ];
    protected $appends           = ['title'];
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
                $columns = [
                    [
                        'name'       => 'company_details',
                        'titleTrans' => 'core.company.company_details.title',
                        'type'       => 'company',
                        'columns'    => Utils::getPreferenceColumns(),
                    ],
                    [
                        'name'       => 'doc_info',
                        'titleTrans' => 'core.printTemplate.doc_info',
                        'type'       => 'docInfo',
                        'columns'    => Utils::getDocInfoColumns(),
                    ],
                ];
                if ($this->model) {
                    $instance  = new $this->model;
                    $columns[] = [
                        'name'       => Str::lower(Str::snake(Str::singular($this->name_model))),
                        'type'       => 'doc',
                        'titleTrans' => isset($instance) ? $instance->translateKey . '.title' : Str::singular($this->name_model),
                        'columns'    => $this->model::getColumns(2),
                    ];
                }

                return $columns;
            },
        );
    }

    protected array $configColumns = [
        'title' => [
            'dependsOn' => ['model'],
        ],
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

    /**
     * Get used relations for eager loading
     */
    public function getUsedRelations(): array {
        return $this->used_relations ?? [];
    }

    /**
     * Set used relations from template
     */
    public function setUsedRelationsFromTemplate(): void {
        $tracker              = app(RelationTrackerService::class);
        $relations            = $tracker->extractRelations($this->template ?? []);
        $this->used_relations = $relations;
    }
}

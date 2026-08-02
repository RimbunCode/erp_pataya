<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Models\User\Permission;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmailTemplate extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'body_json'  => 'array',
        'is_default' => 'boolean',
    ];
    protected $appends           = ['title'];
    public string $keyBreadcrumb = 'name';
    public string $translateKey  = 'core.emailTemplate';
    public string $formComponent = 'Core/EmailTemplate/Form';

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

            $hasOtherTemplate = EmailTemplate::where('model', $model->model)
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

            EmailTemplate::where('model', $model->model)
                ->whereKeyNot($model->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        });
    }

    protected static function loadRelationsOnShow() {
        return ['permission'];
    }

    public function permission() {
        return $this->belongsTo(Permission::class);
    }
}

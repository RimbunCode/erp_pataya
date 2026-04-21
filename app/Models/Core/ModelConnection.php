<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use App\Utils;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ModelConnection extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = [
        'id',
    ];
    public $translateKey     = 'core.modelConnection';
    protected $configColumns = [
        'model',
        'reference',
    ];
    protected $casts = [
        'is_manual' => 'boolean',
        'data'      => Json::class,
    ];

    protected static function booted() {
        static::creating(function ($model) {
            if ($model->model) {
                $model->setAttribute('model_type', \get_class($model->model));
                $model->setAttribute('model_id', $model->model->id);
                $modelDisplay = static::getDisplayFromTemplateLink($model->model);
                $model->setAttribute('model_display', $modelDisplay);
            } elseif (! isset($model->model_display) && $model->model_type && $model->model_id) {
                $modelDisplay = static::getDisplayFromTemplateLink($model->model_type, $model->model_id);
                $model->setAttribute('model_display', $modelDisplay);
            }

            if ($model->reference) {
                $model->setAttribute('reference_type', \get_class($model->reference));
                $model->setAttribute('reference_id', $model->reference->id);
                $referenceDisplay = static::getDisplayFromTemplateLink($model->reference);
                $model->setAttribute('reference_display', $referenceDisplay);
            } elseif (! isset($model->reference_display) && $model->reference_type && $model->reference_id) {
                $referenceDisplay = static::getDisplayFromTemplateLink($model->reference_type, $model->reference_id);
                $model->setAttribute('reference_display', $referenceDisplay);
            }
        });
    }

    public static function getDisplayFromTemplateLink(Model|string $model_type, ?string $model_id = null) {
        $data = \is_string($model_type) ? $model_type::find($model_id) : $model_type;

        if (isset($data->templateLink)) {
            return Utils::convertTemplateLink($data);
        } else {
            $keyBreadcrumb = $data->keyBreadcrumb ?? 'name';

            return $data->$keyBreadcrumb ?? $data->name ?? null;
        }
    }

    public function scopeSearch(Builder $query, ?string $type, string|array $id) {
        if ($type == null || $id == null) {
            return $query;
        }
        $query
            ->selectRaw(
                'id, IF(`model_type` = ?, `reference_type`, `model_type`) as reference_type, IF(`model_type` = ?, `reference_id`, `model_id`) as reference_id, IF(`model_type` = ?, `reference_display`, `model_display`) as reference_display, `data`, `is_manual`',
                [$type, $type, $type],
            );

        return $query->where(function (Builder $query) use ($type, $id): void {
            $query->where(function (Builder $query) use ($type, $id) {
                $query->where('model_type', $type);
                if (\is_array($id)) {
                    $query->whereIn('model_id', $id);
                } else {
                    $query->where('model_id', $id);
                }
            });
            $query->orWhere(function (Builder $query) use ($type, $id) {
                $query->where('reference_type', $type);
                if (\is_array($id)) {
                    $query->whereIn('reference_id', $id);
                } else {
                    $query->where('reference_id', $id);
                }
            });
        });
    }

    public function model(): MorphTo {
        return $this->morphTo(__FUNCTION__, 'model_type', 'model_id');
    }

    public function reference(): MorphTo {
        return $this->morphTo(__FUNCTION__, 'reference_type', 'reference_id');
    }

    public static function createConnection(array $attributes = []) {
        $mType = isset($attributes['model']) ? \get_class($attributes['model']) : $attributes['model_type'];
        $mId   = isset($attributes['model']) ? $attributes['model']->id : $attributes['model_id'];
        $rType = isset($attributes['reference']) ? \get_class($attributes['reference']) : $attributes['reference_type'];
        $rId   = isset($attributes['reference']) ? $attributes['reference']->id : $attributes['reference_id'];

        return static::updateOrCreate([
            'model_type'     => $mType,
            'model_id'       => $mId,
            'reference_type' => $rType,
            'reference_id'   => $rId,
        ], [
            // Tetap pasang object ke dalam array payload agar
            // event creating/updating pada model_display tetap berjalan.
            ...(isset($attributes['model']) ? [
                'model' => $attributes['model'],
            ] : []),
            ...(isset($attributes['reference']) ? [
                'reference' => $attributes['reference'],
            ] : []),
            'data' => $attributes['data'] ?? null,
        ]);
    }
}
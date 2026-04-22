<?php

namespace App\Models\Core;

use App\Casts\Json;
use App\Models\Model;
use App\Utils;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ModelConnection extends Model {
    use HasUlids, SoftDeletes;
    protected $guarded       = [
        'id',
    ];
    public    $translateKey  = 'core.modelConnection';
    protected $configColumns = [
        'model',
        'reference',
    ];
    protected $casts         = [
        'is_manual' => 'boolean',
        'data'      => Json::class,
    ];

    protected static function booted(): void {
        static::saving(function (self $model): void {
            static::syncLinkedAttributes($model, 'model');
            static::syncLinkedAttributes($model, 'reference');
        });
    }

    public static function getDisplayFromTemplateLink(Model|string $model_type, ?string $model_id = null): ?string {
        $data = \is_string($model_type) ? $model_type::find($model_id) : $model_type;

        if (! $data instanceof Model) {
            return null;
        }

        if (isset($data->templateLink)) {
            return Utils::convertTemplateLink($data);
        }

        $keyBreadcrumb = $data->keyBreadcrumb ?? 'name';

        return $data->$keyBreadcrumb ?? $data->name ?? null;
    }

    private static function syncLinkedAttributes(self $model, string $relationName): void {
        $typeAttribute    = "{$relationName}_type";
        $idAttribute      = "{$relationName}_id";
        $displayAttribute = "{$relationName}_display";
        $relatedModel     = static::extractLinkedModel($model, $relationName);

        if ($relatedModel instanceof Model) {
            $model->setAttribute($typeAttribute, \get_class($relatedModel));
            $model->setAttribute($idAttribute, $relatedModel->id);
            $model->setAttribute($displayAttribute, static::getDisplayFromTemplateLink($relatedModel));

            return;
        }

        if (! isset($model->{$displayAttribute}) && $model->{$typeAttribute} && $model->{$idAttribute}) {
            $model->setAttribute($displayAttribute, static::getDisplayFromTemplateLink($model->{$typeAttribute}, $model->{$idAttribute}));
        }
    }

    private static function extractLinkedModel(self $model, string $relationName): ?Model {
        if ($model->relationLoaded($relationName)) {
            $relatedModel = $model->getRelation($relationName);
            $model->unsetRelation($relationName);

            return $relatedModel instanceof Model ? $relatedModel : null;
        }

        $attributes = $model->getAttributes();
        $relatedModel = $attributes[$relationName] ?? null;
        if (\array_key_exists($relationName, $attributes)) {
            unset($model->{$relationName});
        }

        return $relatedModel instanceof Model ? $relatedModel : null;
    }

    public function scopeSearch(Builder $query, ?string $type, string|array $id) {
        if ($type == null || $id == null) {
            return $query;
        }
        $query
            ->selectRaw(
                'id, IF(`model_type` = ?, `reference_type`, `model_type`) as reference_type, IF(`model_type` = ?, `reference_id`, `model_id`) as reference_id, IF(`model_type` = ?, `reference_display`, `model_display`) as reference_display, IF(`model_type` = ?, `model_type`, `reference_type`) as model_type, IF(`model_type` = ?, `model_id`, `reference_id`) as model_id, IF(`model_type` = ?, `model_display`, `reference_display`) as model_display, `data`, `is_manual`',
                [$type, $type, $type, $type, $type, $type],
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

    /**
     * Summary of getReferenceAttributes
     *
     * @param  Closure(Collection<int, ModelConnection>, ModelConnection): void  $eachReference
     * @return Collection<int|string, Collection<int, ModelConnection>>
     */
    public static function getReferenceAttributes(string $model, string|array $ids, callable $eachReference) {
        if (empty($ids)) {
            return collect([]);
        }

        $itemConnections = ModelConnection::with('reference')
            ->search($model, $ids)
            ->get();

        if ($itemConnections->isEmpty()) {
            return collect([]);
        }

        $grouped = [];
        foreach ($itemConnections->groupBy('reference_type') as $type => $connections) {
            $uniqueReference = $connections->unique('reference_id');
            $referenceIds    = $uniqueReference->pluck('reference_id')->toArray();

            if (empty($referenceIds)) {
                continue;
            }

            $referenceGrouped = ModelConnection::search($type, $referenceIds)
                ->having('reference_type', $model)
                ->get()
                ->groupBy('model_id');

            $grouped[$type] = $referenceGrouped;

            foreach ($uniqueReference as $reference) {
                if ($reference->reference === null) {
                    continue;
                }

                $data = $referenceGrouped->get($reference->reference_id, collect([]));
                $eachReference($data, $reference->reference);
            }
        }

        return collect($grouped);
    }
}

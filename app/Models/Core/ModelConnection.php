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

    protected $guarded = [
        'id',
    ];
    public $translateKey = 'core.modelConnection';

    public static function templateLink() {
        return ':model_display - :reference_display';
    }

    protected array $configColumns = [
        'model',
        'reference',
    ];
    protected $casts = [
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
        if (\is_string($model_type) && ! is_subclass_of($model_type, Model::class)) {
            // reference_type/model_type tidak selalu nama kelas model: baris audit
            // (mis. 'sync', 'mark_done') memakai penanda bebas. Tanpa guard ini
            // $model_type::find() melempar Error "Class not found" saat saving().
            return null;
        }

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

        $attributes   = $model->getAttributes();
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
                'id, CASE WHEN `model_type` = ? THEN `reference_type` ELSE `model_type` END as reference_type, CASE WHEN `model_type` = ? THEN `reference_id` ELSE `model_id` END as reference_id, CASE WHEN `model_type` = ? THEN `reference_display` ELSE `model_display` END as reference_display, CASE WHEN `model_type` = ? THEN `model_type` ELSE `reference_type` END as model_type, CASE WHEN `model_type` = ? THEN `model_id` ELSE `reference_id` END as model_id, CASE WHEN `model_type` = ? THEN `model_display` ELSE `reference_display` END as model_display, `data`, `is_manual`',
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

    /**
     * Baris audit (mis. yang ditulis syncItems/markDone) menyimpan penanda bebas
     * seperti 'sync' atau 'mark_done' di kolom tipe, bukan nama kelas model.
     *
     * morphTo() menyelesaikan relasi dengan `new $type`, sehingga eager load
     * `with('reference')` melempar Error "Class not found" begitu salah satu
     * baris memakai penanda tersebut. Mengembalikan null di sini membuat
     * Eloquent melewati baris itu, sama seperti baris dengan tipe kosong.
     */
    public function getModelTypeAttribute(?string $value): ?string {
        return is_subclass_of($value, Model::class) ? $value : null;
    }

    public function getReferenceTypeAttribute(?string $value): ?string {
        return is_subclass_of($value, Model::class) ? $value : null;
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
                ->where(function (Builder $query) use ($type, $model): void {
                    $query->where(fn (Builder $direction) => $direction->where('model_type', $type)->where('reference_type', $model))
                        ->orWhere(fn (Builder $direction) => $direction->where('reference_type', $type)->where('model_type', $model));
                })
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

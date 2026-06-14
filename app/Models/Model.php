<?php

namespace App\Models;

use App\Traits\LinkModel;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Str;
use ReflectionClass;
use ReflectionMethod;
use Throwable;

class Model extends EloquentModel {
    use LinkModel;

    public static function resolveRelationPath(array|string $relationPaths): array {
        if (\is_string($relationPaths)) {
            $relationPaths = [$relationPaths];
        }

        $segmentCache = [];
        $result       = [];
        foreach ($relationPaths as $relationPath) {
            $segments = explode('.', $relationPath);

            $currentModel = new static;
            $resolved     = [];

            foreach ($segments as $segment) {
                $method = Str::camel($segment);

                $cacheKey = $currentModel::class . '::' . $method;

                if (\array_key_exists($cacheKey, $segmentCache)) {
                    ['related' => $related, 'method' => $method] = $segmentCache[$cacheKey];

                    $currentModel = $related;
                    $resolved[]   = $method;

                    continue;
                }
                if (! static::isPublicZeroArgumentMethod($currentModel, $method)) {
                    $segmentCache[$cacheKey] = null;

                    continue 2;
                }

                try {
                    /**
                     * Relation::noConstraints() dipakai agar resolver hanya membaca struktur relasi,
                     * bukan menjalankan constraint relasi berdasarkan instance model tertentu.
                     */
                    $relation = Relation::noConstraints($currentModel->{$method}(...));
                } catch (Throwable) {
                    $segmentCache[$cacheKey] = null;

                    continue 2;
                }

                if (! $relation instanceof Relation) {
                    $segmentCache[$cacheKey] = null;

                    continue 2;
                }

                $currentModel            = $relation->getRelated();
                $resolved[]              = $method;
                $segmentCache[$cacheKey] = [
                    'related' => $relation->getRelated(),
                    'method'  => $method,
                ];
            }

            $result[] = implode('.', $resolved);
        }

        return $result;
    }

    private static function isPublicZeroArgumentMethod(Model $model, string $method): bool {
        if (! method_exists($model, $method)) {
            return false;
        }

        $reflection = new ReflectionMethod($model, $method);

        return $reflection->isPublic()
            && $reflection->getNumberOfRequiredParameters() === 0;
    }

    public function loadAllRelations(...$classRelations) {
        $class       = new ReflectionClass($this);
        $methods     = $class->getMethods();
        $newInstance = $class->newInstance();

        $relations = [];
        foreach ($methods as $method) {
            if (
                $method->class === $class->getName() &&
                $method->isPublic() &&
                ! $method->isStatic() &&
                $method->getNumberOfParameters() === 0
            ) {
                if ($method->name === 'logs') {
                    continue;
                }
                try {
                    $return = $newInstance->{$method->name}();

                    // cek apakah return-nya instance Relation
                    if ($return instanceof Relation) {
                        if (\count($classRelations) > 0) {
                            if (\in_array(\get_class($return), $classRelations)) {
                                $relations[] = $method->name;
                            }
                        } else {
                            $relations[] = $method->name;
                        }
                    }
                } catch (Throwable $th) {
                    // Abaikan method yang bukan relasi
                }
            }
        }

        return $this->load($relations);
    }
}

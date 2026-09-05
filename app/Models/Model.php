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

    /**
     * Kolom sort default untuk halaman List/DataTable (dibaca
     * DataTableScope::addDataTable() sebagai fallback saat request tidak
     * kirim `?sort=`). Null berarti pakai default macro ('created_at').
     * Override di model yang butuh kolom lain lebih representatif sebagai
     * urutan kronologis transaksi (mis. `transaction_date` di GeneralLedger/
     * StockLedgerEntry, di mana created_at bisa beda dari waktu transaksi
     * sebenarnya -- lihat Requirement 2.4 spec event-listener-migration-phase-3).
     */
    protected static ?string $defaultSortColumn = null;

    public static function getDefaultSortColumn(): string {
        return static::$defaultSortColumn ?? 'created_at';
    }

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

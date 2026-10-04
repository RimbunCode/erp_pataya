<?php

namespace App\Models\Asset;

use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Relasi morph pemilik Asset (`ownership_type` + `ownership_id`).
 *
 * Nilai `ownership_type` adalah enum string (`company|supplier|customer`), BUKAN
 * FQCN seperti default morph Laravel, dan `company` bukan model. Daripada
 * mendaftarkan `Relation::morphMap()` GLOBAL (mengubah `getMorphClass()` morph
 * lain yang menunjuk Customer/Supplier -- mis. log/todo/lampiran -- sehingga
 * baris lama ber-FQCN bisa tak ketemu), tipe diterjemahkan lewat peta LOKAL
 * di sini dan tipe di luar peta (`company`) dilewati: tak ada `new company`,
 * tak ada query, relasi bernilai `null`. Spec asset-ownership-morph Requirement 2.
 */
class AssetOwnershipMorphTo extends MorphTo {
    /** @var array<string, class-string> */
    public const MODELS = [
        'supplier' => Supplier::class,
        'customer' => Customer::class,
    ];

    /**
     * Hanya baris bertipe terpetakan yang masuk dictionary eager-load; sisanya
     * (company/NULL/tak dikenal) langsung diberi relasi `null` supaya akses
     * `$asset->ownership` tak memicu query lazy-load per baris.
     */
    #[\Override]
    protected function buildDictionary(EloquentCollection $models) {
        $mapped = $models->filter(function ($model) {
            $type = $model->getAttributes()[$this->morphType] ?? null;
            $type = $type instanceof \BackedEnum ? $type->value : $type;

            if (isset(self::MODELS[$type]) && $model->{$this->foreignKey} !== null) {
                return true;
            }
            $model->setRelation($this->relationName, null);

            return false;
        });

        parent::buildDictionary($mapped);
    }

    #[\Override]
    public function createModelByType($type) {
        $class = self::MODELS[$type] ?? null;
        if ($class === null) {
            throw new \InvalidArgumentException("Tipe ownership tak dikenal: {$type}");
        }

        return tap(new $class, function ($instance) {
            if (! $instance->getConnectionName()) {
                $instance->setConnection($this->getConnection()->getName());
            }
        });
    }
}

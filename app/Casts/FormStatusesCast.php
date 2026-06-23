<?php

namespace App\Casts;

use App\Enums\FormStatus;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class FormStatusesCast implements CastsAttributes {
    /**
     * Cast the given value.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): mixed {
        if ($value == null) {

            return null;
        }
        $decoded = json_decode($value, true);

        if (! is_array($decoded)) {
            return [];
        }

        // Convert string → enum
        $statuses = array_map(
            FormStatus::from(...),
            $decoded,
        );

        return $statuses;
    }

    /**
     * Prepare the given value for storage.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): mixed {
        if (! \is_array($value)) {
            if (! $value instanceof FormStatus) {
                throw new InvalidArgumentException('The given value is not an FormStatus or FormStatus[]');
            }
            $val = [$value];
            $model->setAttribute($key, $val);

            return json_encode($val);
        }

        $statuses = \array_map(function ($item) {
            if ($item == null) {
                return null;
            }
            if (! $item instanceof FormStatus) {
                throw new InvalidArgumentException('The given value is not an FormStatus or FormStatus[]');
            }

            return $item->value;
        }, $value);

        return \json_encode(
            \array_filter(
                $statuses,
                fn ($item) => $item != null,
            ),
        );

    }
}

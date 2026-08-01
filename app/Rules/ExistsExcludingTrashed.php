<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\DB;
use Illuminate\Translation\PotentiallyTranslatedString;

class ExistsExcludingTrashed implements ValidationRule {
    public function __construct(
        private readonly string $table,
        private readonly string $column = 'id',
    ) {}

    /**
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void {
        $exists = DB::table($this->table)
            ->where($this->column, $value)
            ->whereNull('deleted_at')
            ->exists();

        if (! $exists) {
            $fail('validation.exists')->translate();
        }
    }
}

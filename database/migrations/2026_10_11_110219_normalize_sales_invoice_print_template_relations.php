<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void {
        DB::table('print_templates')
            ->where('model', 'App\\Models\\Finances\\SalesInvoice')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->chunkById(200, function ($templates): void {
                foreach ($templates as $template) {
                    $relations  = json_decode((string) $template->used_relations, true);
                    $relations  = is_array($relations) ? $relations : [];
                    $normalized = collect($relations)
                        ->filter(fn (mixed $relation): bool => is_string($relation) && $relation !== '')
                        ->map(function (string $relation): string {
                            return collect(explode('.', $relation))
                                ->map(fn (string $segment): string => Str::camel($segment))
                                ->implode('.');
                        })
                        ->push('currency')
                        ->unique()
                        ->values()
                        ->all();

                    $encoded = json_encode($normalized);
                    if ($encoded === $template->used_relations) {
                        continue;
                    }

                    DB::table('print_templates')->where('id', $template->id)->update([
                        'used_relations' => $encoded,
                        'updated_at'     => now(),
                    ]);
                }
            });
    }

    public function down(): void {
        // Data lama tidak dapat dipulihkan tanpa menyimpan bentuk semula.
    }
};

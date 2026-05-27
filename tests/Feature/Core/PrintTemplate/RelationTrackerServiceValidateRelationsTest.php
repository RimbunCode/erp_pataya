<?php

namespace Tests\Feature\Core\PrintTemplate;

use App\Services\Core\PrintTemplate\RelationTrackerService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Tests\TestCase;

class RelationTrackerServiceValidateRelationsTest extends TestCase {
    public function test_validate_relations_handles_cached_invalid_segments_without_crashing(): void {
        $modelClass = get_class(new class extends Model
        {
            public static function getColumns($schema = null): array {
                return [
                    ['name' => 'id'],
                    ['name' => 'parent_id'],
                ];
            }

            public function parentRelation(): BelongsTo {
                return $this->belongsTo(self::class, 'parent_id');
            }

            public function notARelation(): array {
                return [];
            }
        });

        $service = new RelationTrackerService;

        $validated = $service->validateRelations($modelClass, [
            'parent_relation',
            'parent_relation.parent_relation',
            'not_a_relation',
            'not_a_relation',
        ]);

        $this->assertSame(
            ['parentRelation', 'parentRelation.parentRelation'],
            $validated['relations'],
        );
        $this->assertArrayHasKey($modelClass, $validated['modelColumns']);
        $this->assertArrayHasKey('id', $validated['modelColumns'][$modelClass]);
    }

    public function test_validate_relations_returns_empty_array_when_model_class_not_found(): void {
        $service = new RelationTrackerService;

        $this->assertSame([], $service->validateRelations('App\\Models\\UnknownModel', ['customer']));
    }
}

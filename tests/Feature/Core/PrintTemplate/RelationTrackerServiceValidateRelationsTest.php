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
            public static function getColumns(int $maxDepth = 0, bool $includeHidden = false, ...$excepts): array {
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
        ], true);

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

    public function test_validate_relations_expands_default_with_and_caches_related_model_columns(): void {
        $service = new RelationTrackerService;

        $validated = $service->validateRelations(RelationTrackerValidateRelationsStockEntryModel::class, ['branch'], true);

        $this->assertSame([
            'branch',
            'branch.shippingCountry',
            'branch.billingCountry',
        ], $validated['relations']);
        $this->assertArrayHasKey(RelationTrackerValidateRelationsStockEntryModel::class, $validated['modelColumns']);
        $this->assertArrayHasKey(RelationTrackerValidateRelationsBranchModel::class, $validated['modelColumns']);
        $this->assertArrayHasKey(RelationTrackerValidateRelationsCountryModel::class, $validated['modelColumns']);
    }
}

class RelationTrackerValidateRelationsStockEntryModel extends Model {
    public static function getColumns(int $maxDepth = 0, bool $includeHidden = false, ...$excepts): array {
        return [
            ['name' => 'id'],
            ['name' => 'branch_id'],
        ];
    }

    public function branch(): BelongsTo {
        return $this->belongsTo(RelationTrackerValidateRelationsBranchModel::class, 'branch_id');
    }
}

class RelationTrackerValidateRelationsBranchModel extends Model {
    protected $with = [
        'shippingCountry',
        'billingCountry',
    ];

    public static function getColumns(int $maxDepth = 0, bool $includeHidden = false, ...$excepts): array {
        return [
            ['name' => 'id'],
            ['name' => 'shipping_country_id'],
            ['name' => 'billing_country_id'],
        ];
    }

    public function shippingCountry(): BelongsTo {
        return $this->belongsTo(RelationTrackerValidateRelationsCountryModel::class, 'shipping_country_id');
    }

    public function billingCountry(): BelongsTo {
        return $this->belongsTo(RelationTrackerValidateRelationsCountryModel::class, 'billing_country_id');
    }
}

class RelationTrackerValidateRelationsCountryModel extends Model {
    public static function getColumns(int $maxDepth = 0, bool $includeHidden = false, ...$excepts): array {
        return [
            ['name' => 'code'],
            ['name' => 'name'],
        ];
    }
}

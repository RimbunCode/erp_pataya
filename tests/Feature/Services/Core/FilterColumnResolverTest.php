<?php

namespace Tests\Feature\Services\Core;

use App\Services\Core\FilterColumnResolver;
use Tests\TestCase;

/**
 * Stub model terkait dengan getColumns statis — menguji lazy-load kolom anak
 * relasi tanpa boot Eloquent relation sungguhan.
 */
class ResolverRelatedStub {
    /** @return list<array<string,mixed>> */
    public static function getColumns(int $maxDepth = 0): array {
        return [
            ['name' => 'type', 'type' => 'string', 'searchable' => true],
            ['name' => 'code', 'type' => 'string', 'searchable' => true],
        ];
    }
}

class ResolverMorphStub {
    /** @return list<array<string,mixed>> */
    public static function getColumns(int $maxDepth = 0): array {
        return [
            ['name' => 'title', 'type' => 'string', 'searchable' => true],
        ];
    }
}

class FilterColumnResolverTest extends TestCase {
    /** @var list<array<string,mixed>> */
    private array $columns;

    protected function setUp(): void {
        parent::setUp();

        // Root columns: skalar + relasi basic (category, children kosong → lazy)
        // + relasi morph (commentable).
        $this->columns = [
            ['name' => 'name', 'type' => 'string', 'searchable' => true],
            [
                'name'         => 'category',
                'type'         => 'relation',
                'typeRelation' => 'basic',
                'related'      => ResolverRelatedStub::class,
                'columns'      => [], // kosong (mensimulasikan getColumns(1) bug)
                'searchable'   => true,
            ],
            [
                'name'         => 'commentable',
                'type'         => 'relation',
                'typeRelation' => 'morph',
                'related'      => null,
                'columns'      => [],
                'searchable'   => true,
            ],
        ];
    }

    private function resolver(): FilterColumnResolver {
        return new FilterColumnResolver($this->columns);
    }

    public function test_resolves_scalar_column(): void {
        $col = $this->resolver()->resolve('name');
        $this->assertNotNull($col);
        $this->assertSame('string', $col['type']);
    }

    public function test_lazy_resolves_basic_relation_child(): void {
        $col = $this->resolver()->resolve('category.type');
        $this->assertNotNull($col, 'kolom anak relasi harus ter-resolve via lazy load');
        $this->assertSame('type', $col['name']);
        $this->assertSame('string', $col['type']);
    }

    public function test_unknown_relation_child_returns_null(): void {
        $this->assertNull($this->resolver()->resolve('category.nonexistent'));
    }

    public function test_morph_resolves_child_from_value_type(): void {
        // value morph membawa FQCN model konkret
        $value = ['type' => ResolverMorphStub::class, 'id' => 'x'];
        $col   = $this->resolver()->resolve('commentable.title', $value);
        $this->assertNotNull($col);
        $this->assertSame('title', $col['name']);
    }

    public function test_morph_without_value_type_returns_null(): void {
        $this->assertNull($this->resolver()->resolve('commentable.title', null));
    }

    public function test_non_relation_middle_segment_returns_null(): void {
        // 'name' skalar tidak bisa jadi segmen tengah
        $this->assertNull($this->resolver()->resolve('name.something'));
    }
}

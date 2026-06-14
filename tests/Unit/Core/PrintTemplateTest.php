<?php

namespace Tests\Unit\Core;

use App\Models\Core\PrintTemplate;
use PHPUnit\Framework\TestCase;

class PrintTemplateTest extends TestCase {
    /**
     * Test getUsedRelations returns array when used_relations is set
     */
    public function test_get_used_relations_returns_array_when_set(): void {
        $template                 = new PrintTemplate;
        $template->used_relations = ['customer', 'items'];

        $relations = $template->getUsedRelations();

        $this->assertIsArray($relations);
        $this->assertEquals(['customer', 'items'], $relations);
    }

    /**
     * Test getUsedRelations returns empty array when used_relations is null
     */
    public function test_get_used_relations_returns_empty_array_when_null(): void {
        $template                 = new PrintTemplate;
        $template->used_relations = null;

        $relations = $template->getUsedRelations();

        $this->assertIsArray($relations);
        $this->assertEmpty($relations);
    }

    /**
     * Test getUsedRelations returns empty array when used_relations is not set
     */
    public function test_get_used_relations_returns_empty_array_when_not_set(): void {
        $template = new PrintTemplate;

        $relations = $template->getUsedRelations();

        $this->assertIsArray($relations);
        $this->assertEmpty($relations);
    }

    /**
     * Test setUsedRelationsFromTemplate sets empty array (placeholder implementation)
     */
    public function test_set_used_relations_from_template_sets_empty_array(): void {
        $template                 = new PrintTemplate;
        $template->template       = ['components' => []];
        $template->used_relations = ['old_relation'];

        $template->setUsedRelationsFromTemplate();

        $this->assertIsArray($template->used_relations);
        $this->assertEmpty($template->used_relations);
    }

    /**
     * Test setUsedRelationsFromTemplate can be called on new instance
     */
    public function test_set_used_relations_from_template_works_on_new_instance(): void {
        $template           = new PrintTemplate;
        $template->template = ['components' => []];

        $template->setUsedRelationsFromTemplate();

        $this->assertIsArray($template->used_relations);
        $this->assertEmpty($template->used_relations);
    }

    /**
     * Test getUsedRelations with complex relation paths
     */
    public function test_get_used_relations_with_complex_paths(): void {
        $template                 = new PrintTemplate;
        $template->used_relations = [
            'customer',
            'customer.address',
            'items',
            'items.product',
            'items.product.category',
        ];

        $relations = $template->getUsedRelations();

        $this->assertIsArray($relations);
        $this->assertCount(5, $relations);
        $this->assertContains('customer', $relations);
        $this->assertContains('customer.address', $relations);
        $this->assertContains('items.product.category', $relations);
    }
}

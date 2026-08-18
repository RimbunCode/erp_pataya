<?php

namespace Tests\Unit\Models\Core;

use App\Models\Core\PrintTemplate;
use PHPUnit\Framework\TestCase;

class PrintTemplateRelationTrackingTest extends TestCase {
    /**
     * Test setUsedRelationsFromTemplate extracts relations from template
     *
     * **Validates: Requirements 11.7**
     */
    public function test_set_used_relations_from_template_extracts_relations(): void {
        $printTemplate           = new PrintTemplate;
        $printTemplate->template = [
            'html' => '
                <div>{{relation doc.customer}}</div>
                <table>
                    {{#each doc.items}}
                    <tr>
                        <td>{{this.product.name}}</td>
                    </tr>
                    {{/each}}
                </table>
            ',
        ];

        $printTemplate->setUsedRelationsFromTemplate();

        $this->assertIsArray($printTemplate->used_relations);
        $this->assertContains('customer', $printTemplate->used_relations);
        $this->assertContains('items', $printTemplate->used_relations);
        $this->assertContains('items.product', $printTemplate->used_relations);
    }

    /**
     * Test getUsedRelations returns empty array when no relations set
     *
     * **Validates: Requirements 11.14**
     */
    public function test_get_used_relations_returns_empty_array_when_null(): void {
        $printTemplate = new PrintTemplate;

        $this->assertEquals([], $printTemplate->getUsedRelations());
    }

    /**
     * Test getUsedRelations returns stored relations
     *
     * **Validates: Requirements 11.6**
     */
    public function test_get_used_relations_returns_stored_relations(): void {
        $printTemplate                 = new PrintTemplate;
        $printTemplate->used_relations = ['customer', 'items', 'product'];

        $this->assertEquals(['customer', 'items', 'product'], $printTemplate->getUsedRelations());
    }

    /**
     * Test setUsedRelationsFromTemplate handles empty template
     *
     * **Validates: Requirements 11.14**
     */
    public function test_set_used_relations_handles_empty_template(): void {
        $printTemplate           = new PrintTemplate;
        $printTemplate->template = [];

        $printTemplate->setUsedRelationsFromTemplate();

        $this->assertEquals([], $printTemplate->used_relations);
    }

    /**
     * Test setUsedRelationsFromTemplate handles template with no relations
     *
     * **Validates: Requirements 11.14**
     */
    public function test_set_used_relations_handles_template_without_relations(): void {
        $printTemplate           = new PrintTemplate;
        $printTemplate->template = [
            'html' => '<div>{{doc.name}}</div><div>{{doc.total}}</div>',
        ];

        $printTemplate->setUsedRelationsFromTemplate();

        $this->assertEquals([], $printTemplate->used_relations);
    }

    /**
     * Test setUsedRelationsFromTemplate normalizes relations
     *
     * **Validates: Requirements 11.13**
     */
    public function test_set_used_relations_normalizes_relations(): void {
        $printTemplate           = new PrintTemplate;
        $printTemplate->template = [
            'html' => '
                <div>{{relation doc.customer}}</div>
                <div>{{relation doc.customer}}</div>
                <div>{{relation doc.warehouse}}</div>
            ',
        ];

        $printTemplate->setUsedRelationsFromTemplate();

        // Should have no duplicates and be sorted
        $this->assertCount(2, $printTemplate->used_relations);
        $this->assertEquals(['customer', 'warehouse'], $printTemplate->used_relations);
    }
}

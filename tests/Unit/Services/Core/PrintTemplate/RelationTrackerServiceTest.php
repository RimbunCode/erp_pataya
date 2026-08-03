<?php

namespace Tests\Unit\Services\Core\PrintTemplate;

use App\Services\Core\PrintTemplate\RelationTrackerService;
use PHPUnit\Framework\TestCase;

class RelationTrackerServiceTest extends TestCase {
    protected RelationTrackerService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new RelationTrackerService;
    }

    /**
     * Test extracting relations from simple {{relation doc.relationName}} pattern
     *
     * **Validates: Requirements 11.1, 11.11**
     */
    public function test_extracts_simple_relation_pattern(): void {
        $html = '<div>{{relation doc.customer}}</div>';

        $relations = $this->service->extractRelationsFromHTML($html);

        $this->assertContains('customer', $relations);
    }

    /**
     * Test extracting relations from {{#each relationName}} pattern
     *
     * **Validates: Requirements 11.2, 11.11**
     */
    public function test_extracts_each_iteration_pattern(): void {
        $html = '<table>{{#each doc.items}}<tr><td>{{this.name}}</td></tr>{{/each}}</table>';

        $relations = $this->service->extractRelationsFromHTML($html);

        $this->assertContains('items', $relations);
    }

    /**
     * Test extracting relations from dot notation {{doc.relation.property}}
     *
     * **Validates: Requirements 11.3, 11.11**
     */
    public function test_extracts_dot_notation_relations(): void {
        $html = '<div>{{doc.customer.name}}</div>';

        $relations = $this->service->extractRelationsFromHTML($html);

        $this->assertContains('customer', $relations);
    }

    /**
     * Test extracting nested relations up to 4 levels
     *
     * **Validates: Requirements 11.4, 11.8**
     */
    public function test_extracts_nested_relations_up_to_four_levels(): void {
        $html = '<div>{{doc.order.customer.address.name.role}}</div>';

        $relations = $this->service->extractRelationsFromHTML($html);

        $this->assertContains('order', $relations);
        $this->assertContains('order.customer', $relations);
        $this->assertContains('order.customer.address', $relations);
        $this->assertContains('order.customer.address.name', $relations);
        $this->assertNotContains('order.customer.address.name.role', $relations);
    }

    /**
     * Test extracting relations from {{this.relation}} within iteration blocks
     *
     * **Validates: Requirements 11.11**
     */
    public function test_extracts_this_relation_in_iteration(): void {
        $html = '{{#each doc.items}}<div>{{this.product.name}}</div>{{/each}}';

        $relations = $this->service->extractRelationsFromHTML($html);

        $this->assertContains('items', $relations);
        $this->assertContains('items.product', $relations);
    }

    /**
     * Test extracting multiple different relations from complex template
     *
     * **Validates: Requirements 11.5**
     */
    public function test_extracts_multiple_relations_from_complex_template(): void {
        $html = '
            <div>{{relation doc.customer}}</div>
            <div>{{doc.warehouse.name}}</div>
            <table>
                {{#each doc.items}}
                <tr>
                    <td>{{this.product.name}}</td>
                    <td>{{this.unit.symbol}}</td>
                </tr>
                {{/each}}
            </table>
            <div>{{relation doc.amended_from}}</div>
        ';

        $relations = $this->service->extractRelationsFromHTML($html);

        $this->assertContains('customer', $relations);
        $this->assertContains('warehouse', $relations);
        $this->assertContains('items', $relations);
        $this->assertContains('items.product', $relations);
        $this->assertContains('items.unit', $relations);
        $this->assertContains('amended_from', $relations);
    }

    /**
     * Test normalizeRelations removes duplicates
     *
     * **Validates: Requirements 11.13**
     */
    public function test_normalize_removes_duplicates(): void {
        $relations = ['customer', 'items', 'customer', 'items', 'product'];

        $normalized = $this->service->normalizeRelations($relations);

        $this->assertCount(3, $normalized);
        $this->assertContains('customer', $normalized);
        $this->assertContains('items', $normalized);
        $this->assertContains('product', $normalized);
    }

    /**
     * Test normalizeRelations sorts alphabetically
     *
     * **Validates: Requirements 11.13**
     */
    public function test_normalize_sorts_alphabetically(): void {
        $relations = ['warehouse', 'customer', 'items', 'amended_from'];

        $normalized = $this->service->normalizeRelations($relations);

        $this->assertEquals(['amended_from', 'customer', 'items', 'warehouse'], $normalized);
    }

    /**
     * Test normalizeRelations filters out empty values
     *
     * **Validates: Requirements 11.13**
     */
    public function test_normalize_filters_empty_values(): void {
        $relations = ['customer', '', 'items', null, 'product'];

        $normalized = $this->service->normalizeRelations($relations);

        $this->assertCount(3, $normalized);
        $this->assertNotContains('', $normalized);
        $this->assertNotContains(null, $normalized);
    }

    /**
     * Test normalizeRelations limits depth to 4 levels
     *
     * **Validates: Requirements 11.8**
     */
    public function test_normalize_limits_depth_to_four_levels(): void {
        $relations = [
            'customer',
            'customer.address',
            'customer.address.city',
            'customer.address.city.country', // 4 levels - maximum relation can be eager load
            'customer.address.city.country.test', // 5 levels - should be filtered out
        ];

        $normalized = $this->service->normalizeRelations($relations);

        $this->assertContains('customer', $normalized);
        $this->assertContains('customer.address', $normalized);
        $this->assertContains('customer.address.city', $normalized);
        $this->assertContains('customer.address.city.country', $normalized);
        $this->assertNotContains('customer.address.city.country.test', $normalized);
    }

    /**
     * Test extractRelations from template array structure
     *
     * **Validates: Requirements 11.1**
     */
    public function test_extracts_relations_from_template_array(): void {
        $template = [
            'html'       => '<div>{{relation doc.customer}}</div>',
            'components' => [
                [
                    'content' => '{{#each doc.items}}<div>{{this.product}}</div>{{/each}}',
                ],
            ],
        ];

        $relations = $this->service->extractRelations($template);

        $this->assertContains('customer', $relations);
        $this->assertContains('items', $relations);
        $this->assertNotContains('product', $relations);
    }

    /**
     * Test extractRelations from nested components
     *
     * **Validates: Requirements 11.1**
     */
    public function test_extracts_relations_from_nested_components(): void {
        $template = [
            'components' => [
                [
                    'content'    => '{{relation doc.customer}}',
                    'components' => [
                        [
                            'content'    => '{{doc.warehouse.name}}',
                            'components' => [
                                [
                                    'content' => '{{#each doc.items}}{{this.product}}{{/each}}',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $relations = $this->service->extractRelations($template);

        $this->assertContains('customer', $relations);
        $this->assertContains('warehouse', $relations);
        $this->assertContains('items', $relations);
        $this->assertNotContains('product', $relations);
    }

    /**
     * Test extractRelations from component attributes
     *
     * **Validates: Requirements 11.1**
     */
    public function test_extracts_relations_from_component_attributes(): void {
        $template = [
            'components' => [
                [
                    'attributes' => [
                        'data-relations' => '["customer", "items"]',
                        'title'          => '{{doc.warehouse.name}}',
                    ],
                ],
            ],
        ];

        $relations = $this->service->extractRelations($template);

        $this->assertContains('customer', $relations);
        $this->assertContains('items', $relations);
        $this->assertContains('warehouse', $relations);
    }

    /**
     * Test extractRelations handles string template (HTML only)
     *
     * **Validates: Requirements 11.1**
     */
    public function test_extracts_relations_from_string_template(): void {
        $template = '<div>{{relation doc.customer}}</div><div>{{#each doc.items}}{{this.product}}{{/each}}</div>';

        $relations = $this->service->extractRelations($template);

        $this->assertContains('customer', $relations);
        $this->assertContains('items', $relations);
        $this->assertNotContains('product', $relations);
    }

    /**
     * Test extractRelations returns empty array for template without relations
     *
     * **Validates: Requirements 11.14**
     */
    public function test_returns_empty_array_for_template_without_relations(): void {
        $template = [
            'html' => '<div>{{doc.name}}</div><div>{{doc.total}}</div>',
        ];

        $relations = $this->service->extractRelations($template);

        $this->assertEmpty($relations);
    }

    /**
     * Test extractRelations handles relation without doc prefix
     *
     * **Validates: Requirements 11.11**
     */
    public function test_extracts_relations_without_doc_prefix(): void {
        $html = '{{relation customer}} {{#each doc.items}}{{this.name}}{{/each}}';

        $relations = $this->service->extractRelationsFromHTML($html);

        $this->assertNotContains('customer', $relations);
        $this->assertContains('items', $relations);
    }

    /**
     * Test extractRelations handles amended_from relation pattern
     *
     * **Validates: Requirements 11.5**
     */
    public function test_extracts_amended_from_relation(): void {
        $html = '<div>{{relation doc.amended_from}}</div><div>{{doc.amended_from.customer}}</div>';

        $relations = $this->service->extractRelationsFromHTML($html);

        $this->assertContains('amended_from', $relations);
        $this->assertNotContains('amended_from.customer', $relations);
    }

    /**
     * Test getRelationDepth returns correct depth
     *
     * **Validates: Requirements 11.8**
     */
    public function test_get_relation_depth_returns_correct_depth(): void {
        $reflection = new \ReflectionClass($this->service);
        $method     = $reflection->getMethod('getRelationDepth');

        $this->assertEquals(1, $method->invoke($this->service, 'customer'));
        $this->assertEquals(2, $method->invoke($this->service, 'customer.address'));
        $this->assertEquals(3, $method->invoke($this->service, 'order.customer.address'));
        $this->assertEquals(4, $method->invoke($this->service, 'order.customer.address.city'));
    }

    /**
     * Test extractRelations handles whitespace in tokens
     *
     * **Validates: Requirements 11.11**
     */
    public function test_extracts_relations_with_whitespace_in_tokens(): void {
        $html = '{{ relation doc.customer }} {{ #each doc.items }} {{ this.product }} {{ /each }}';

        $relations = $this->service->extractRelationsFromHTML($html);

        $this->assertContains('customer', $relations);
        $this->assertContains('items', $relations);
        $this->assertNotContains('product', $relations);
    }

    /**
     * Test extractRelations handles mixed patterns in single template
     *
     * **Validates: Requirements 11.11, 11.12**
     */
    public function test_extracts_all_relation_patterns_together(): void {
        $html = '
            {{relation doc.customer}}
            {{doc.warehouse.name}}
            {{#each doc.items}}
                {{this.product.name}}
                {{relation this.unit}}
            {{/each}}
            {{doc.amended_from.customer.name}}
        ';

        $relations = $this->service->extractRelationsFromHTML($html);

        // Check all expected relations are present
        $this->assertContains('customer', $relations);
        $this->assertContains('warehouse', $relations);
        $this->assertContains('items', $relations);
        $this->assertContains('items.product', $relations);
        $this->assertContains('items.unit', $relations);
        $this->assertContains('amended_from', $relations);
        $this->assertContains('amended_from.customer', $relations);

        // Verify no duplicates
        $this->assertEquals(count($relations), count(array_unique($relations)));
    }
}

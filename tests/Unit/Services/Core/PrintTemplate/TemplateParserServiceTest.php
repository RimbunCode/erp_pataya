<?php

namespace Tests\Unit\Services\Core\PrintTemplate;

use App\Services\Core\PrintTemplate\RelationTrackerService;
use App\Services\Core\PrintTemplate\TemplateParserService;
use App\Services\Core\PrintTemplate\ValidationResult;
use PHPUnit\Framework\TestCase;

class TemplateParserServiceTest extends TestCase {
    protected TemplateParserService $service;
    protected RelationTrackerService $relationTracker;

    protected function setUp(): void {
        parent::setUp();

        $this->relationTracker = new RelationTrackerService;
        $this->service         = new TemplateParserService($this->relationTracker);
    }

    /**
     * Test parse method converts GrapeJS components to JSON structure
     */
    public function test_parse_converts_components_to_json_structure(): void {
        $components = [
            [
                'type'       => 'text',
                'tagName'    => 'div',
                'content'    => 'Hello World',
                'attributes' => ['class' => 'text-bold'],
            ],
        ];

        $result = $this->service->parse($components);

        $this->assertIsArray($result);
        $this->assertCount(1, $result);
        $this->assertEquals('text', $result[0]['type']);
        $this->assertEquals('div', $result[0]['tagName']);
        $this->assertEquals('Hello World', $result[0]['content']);
        $this->assertEquals(['class' => 'text-bold'], $result[0]['attributes']);
    }

    /**
     * Test parse preserves all component attributes including data-* attributes
     */
    public function test_parse_preserves_data_attributes(): void {
        $components = [
            [
                'type'       => 'variable',
                'tagName'    => 'span',
                'content'    => '{{doc.customerName}}',
                'attributes' => [
                    'class'          => 'variable-item',
                    'data-id'        => 'customer-name',
                    'data-relations' => '["customer"]',
                    'data-type'      => 'relation',
                ],
            ],
        ];

        $result = $this->service->parse($components);

        $this->assertArrayHasKey('attributes', $result[0]);
        $this->assertEquals('customer-name', $result[0]['attributes']['data-id']);
        $this->assertEquals('["customer"]', $result[0]['attributes']['data-relations']);
        $this->assertEquals('relation', $result[0]['attributes']['data-type']);
    }

    /**
     * Test parse handles nested components recursively
     */
    public function test_parse_handles_nested_components(): void {
        $components = [
            [
                'type'       => 'wrapper',
                'tagName'    => 'div',
                'components' => [
                    [
                        'type'    => 'text',
                        'tagName' => 'p',
                        'content' => 'Nested content',
                    ],
                    [
                        'type'       => 'container',
                        'tagName'    => 'div',
                        'components' => [
                            [
                                'type'    => 'text',
                                'tagName' => 'span',
                                'content' => 'Deeply nested',
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $result = $this->service->parse($components);

        $this->assertArrayHasKey('components', $result[0]);
        $this->assertCount(2, $result[0]['components']);
        $this->assertEquals('Nested content', $result[0]['components'][0]['content']);
        $this->assertArrayHasKey('components', $result[0]['components'][1]);
        $this->assertEquals('Deeply nested', $result[0]['components'][1]['components'][0]['content']);
    }

    /**
     * Test parse preserves component properties
     */
    public function test_parse_preserves_component_properties(): void {
        $components = [
            [
                'type'          => 'custom',
                'tagName'       => 'div',
                'name'          => 'CustomComponent',
                'draggable'     => true,
                'droppable'     => false,
                'editable'      => true,
                'selectable'    => true,
                'highlightable' => true,
                'copyable'      => true,
                'removable'     => true,
                'resizable'     => false,
            ],
        ];

        $result = $this->service->parse($components);

        $this->assertEquals('CustomComponent', $result[0]['name']);
        $this->assertTrue($result[0]['draggable']);
        $this->assertFalse($result[0]['droppable']);
        $this->assertTrue($result[0]['editable']);
        $this->assertTrue($result[0]['selectable']);
        $this->assertTrue($result[0]['highlightable']);
        $this->assertTrue($result[0]['copyable']);
        $this->assertTrue($result[0]['removable']);
        $this->assertFalse($result[0]['resizable']);
    }

    /**
     * Test extractTokens finds all Handlebar tokens in template
     */
    public function test_extract_tokens_finds_all_handlebar_tokens(): void {
        $components = [
            [
                'type'    => 'text',
                'content' => '{{doc.customerName}} - {{doc.invoiceNumber}}',
            ],
            [
                'type'    => 'text',
                'content' => '{{#each items}}{{this.name}}{{/each}}',
            ],
        ];

        $tokens = $this->service->extractTokens($components);

        $this->assertIsArray($tokens);
        $this->assertContains('{{doc.customerName}}', $tokens);
        $this->assertContains('{{doc.invoiceNumber}}', $tokens);
        $this->assertContains('{{#each items}}', $tokens);
        $this->assertContains('{{this.name}}', $tokens);
        $this->assertContains('{{/each}}', $tokens);
    }

    /**
     * Test extractTokens removes duplicates
     */
    public function test_extract_tokens_removes_duplicates(): void {
        $components = [
            [
                'type'    => 'text',
                'content' => '{{doc.name}} {{doc.name}}',
            ],
            [
                'type'    => 'text',
                'content' => '{{doc.name}}',
            ],
        ];

        $tokens = $this->service->extractTokens($components);

        $this->assertCount(1, $tokens);
        $this->assertEquals(['{{doc.name}}'], $tokens);
    }

    /**
     * Test extractTokens finds tokens in attributes
     */
    public function test_extract_tokens_finds_tokens_in_attributes(): void {
        $components = [
            [
                'type'       => 'text',
                'attributes' => [
                    'title' => '{{doc.customerName}}',
                    'alt'   => '{{doc.description}}',
                ],
            ],
        ];

        $tokens = $this->service->extractTokens($components);

        $this->assertContains('{{doc.customerName}}', $tokens);
        $this->assertContains('{{doc.description}}', $tokens);
    }

    /**
     * Test extractTokens handles nested components
     */
    public function test_extract_tokens_handles_nested_components(): void {
        $components = [
            [
                'type'       => 'wrapper',
                'content'    => '{{doc.header}}',
                'components' => [
                    [
                        'type'    => 'text',
                        'content' => '{{doc.body}}',
                    ],
                ],
            ],
        ];

        $tokens = $this->service->extractTokens($components);

        $this->assertContains('{{doc.header}}', $tokens);
        $this->assertContains('{{doc.body}}', $tokens);
    }

    /**
     * Test validate returns valid result for correct template
     */
    public function test_validate_returns_valid_for_correct_template(): void {
        $template = [
            [
                'type'    => 'text',
                'tagName' => 'div',
                'content' => '{{doc.name}}',
            ],
        ];

        $result = $this->service->validate($template);

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertTrue($result->passed());
        $this->assertFalse($result->failed());
        $this->assertEmpty($result->errors);
    }

    /**
     * Test validate detects missing type property
     */
    public function test_validate_detects_missing_type(): void {
        $template = [
            [
                'tagName' => 'div',
                'content' => 'Hello',
            ],
        ];

        $result = $this->service->validate($template);

        $this->assertFalse($result->passed());
        $this->assertTrue($result->failed());
        $this->assertNotEmpty($result->errors);
        $this->assertStringContainsString('missing \'type\' property', $result->errors[0]);
    }

    /**
     * Test validate detects invalid attributes property
     */
    public function test_validate_detects_invalid_attributes(): void {
        $template = [
            [
                'type'       => 'text',
                'attributes' => 'invalid', // Should be array
            ],
        ];

        $result = $this->service->validate($template);

        $this->assertFalse($result->passed());
        $this->assertStringContainsString('invalid \'attributes\' property', $result->errors[0]);
    }

    /**
     * Test validate detects unclosed block helpers
     */
    public function test_validate_detects_unclosed_block_helpers(): void {
        $template = [
            [
                'type'    => 'text',
                'content' => '{{#each items}}{{this.name}}', // Missing {{/each}}
            ],
        ];

        $result = $this->service->validate($template);

        $this->assertFalse($result->passed());
        $this->assertNotEmpty($result->errors);
        $this->assertStringContainsString('Unclosed block helper', $result->errors[0]);
    }

    /**
     * Test validate returns warnings for empty template
     */
    public function test_validate_warns_for_empty_template(): void {
        $template = [];

        $result = $this->service->validate($template);

        $this->assertTrue($result->passed()); // Empty is valid but has warning
        $this->assertTrue($result->hasWarnings());
        $this->assertContains('Template is empty', $result->warnings);
    }

    /**
     * Test validate handles nested components
     */
    public function test_validate_handles_nested_components(): void {
        $template = [
            [
                'type'       => 'wrapper',
                'components' => [
                    [
                        'tagName' => 'div', // Missing type
                    ],
                ],
            ],
        ];

        $result = $this->service->validate($template);

        $this->assertFalse($result->passed());
        $this->assertNotEmpty($result->errors);
    }

    /**
     * Test extractRelations uses RelationTrackerService
     */
    public function test_extract_relations_uses_relation_tracker(): void {
        $template = [
            'components' => [
                [
                    'type'    => 'text',
                    'content' => '{{relation doc.customer}}',
                ],
                [
                    'type'    => 'text',
                    'content' => '{{#each doc.items}}{{this.name}}{{/each}}',
                ],
            ],
        ];

        $relations = $this->service->extractRelations($template);

        $this->assertIsArray($relations);
        $this->assertContains('customer', $relations);
        $this->assertContains('items', $relations);
    }

    /**
     * Test parseWithRelations returns both template and relations
     */
    public function test_parse_with_relations_returns_template_and_relations(): void {
        $components = [
            [
                'type'    => 'text',
                'tagName' => 'div',
                'content' => '{{relation doc.customer}}',
            ],
            [
                'type'    => 'text',
                'content' => '{{#each doc.items}}{{this.product}}{{/each}}',
            ],
        ];

        $result = $this->service->parseWithRelations($components);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('template', $result);
        $this->assertArrayHasKey('used_relations', $result);

        // Check template is parsed
        $this->assertIsArray($result['template']);
        $this->assertCount(2, $result['template']);
        $this->assertEquals('text', $result['template'][0]['type']);

        // Check relations are extracted
        $this->assertIsArray($result['used_relations']);
        $this->assertContains('customer', $result['used_relations']);
        $this->assertContains('items', $result['used_relations']);
    }

    /**
     * Test parseWithRelations handles empty components
     */
    public function test_parse_with_relations_handles_empty_components(): void {
        $components = [];

        $result = $this->service->parseWithRelations($components);

        $this->assertIsArray($result);
        $this->assertEmpty($result['template']);
        $this->assertEmpty($result['used_relations']);
    }

    /**
     * Test ValidationResult helper methods
     */
    public function test_validation_result_helper_methods(): void {
        $result = new ValidationResult(
            false,
            ['Error 1', 'Error 2'],
            ['Warning 1'],
        );

        $this->assertFalse($result->passed());
        $this->assertTrue($result->failed());
        $this->assertTrue($result->hasWarnings());

        $allMessages = $result->getAllMessages();
        $this->assertCount(3, $allMessages);
        $this->assertContains('Error 1', $allMessages);
        $this->assertContains('Warning 1', $allMessages);
    }

    /**
     * Test parse preserves styles and classes
     */
    public function test_parse_preserves_styles_and_classes(): void {
        $components = [
            [
                'type'    => 'text',
                'tagName' => 'div',
                'styles'  => [
                    'color'     => 'red',
                    'font-size' => '16px',
                ],
                'classes' => ['text-bold', 'text-center'],
            ],
        ];

        $result = $this->service->parse($components);

        $this->assertArrayHasKey('styles', $result[0]);
        $this->assertEquals(['color' => 'red', 'font-size' => '16px'], $result[0]['styles']);
        $this->assertArrayHasKey('classes', $result[0]);
        $this->assertEquals(['text-bold', 'text-center'], $result[0]['classes']);
    }

    /**
     * Test round-trip parsing (parse then serialize should be equivalent)
     */
    public function test_round_trip_parsing(): void {
        $components = [
            [
                'type'       => 'wrapper',
                'tagName'    => 'div',
                'attributes' => [
                    'class'   => 'container',
                    'data-id' => 'main',
                ],
                'components' => [
                    [
                        'type'    => 'text',
                        'tagName' => 'p',
                        'content' => '{{doc.name}}',
                    ],
                ],
            ],
        ];

        $parsed = $this->service->parse($components);

        // Verify structure is preserved
        $this->assertEquals('wrapper', $parsed[0]['type']);
        $this->assertEquals('div', $parsed[0]['tagName']);
        $this->assertEquals('container', $parsed[0]['attributes']['class']);
        $this->assertEquals('main', $parsed[0]['attributes']['data-id']);
        $this->assertCount(1, $parsed[0]['components']);
        $this->assertEquals('{{doc.name}}', $parsed[0]['components'][0]['content']);
    }
}

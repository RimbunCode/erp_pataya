<?php

namespace Tests\Unit\Services\Core\PrintTemplate;

use App\Services\Core\PrintTemplate\TemplateSerializerService;
use PHPUnit\Framework\TestCase;

class TemplateSerializerServiceTest extends TestCase {
    protected TemplateSerializerService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new TemplateSerializerService;
    }

    /**
     * Test serializing template with components structure
     *
     * **Validates: Requirements 10.2**
     */
    public function test_serialize_returns_template_with_components(): void {
        $template = [
            'components' => [
                ['type' => 'text', 'content' => 'Hello World'],
            ],
        ];

        $result = $this->service->serialize($template);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('components', $result);
        $this->assertEquals($template, $result);
    }

    /**
     * Test serializing component array wraps it in components key
     *
     * **Validates: Requirements 10.2**
     */
    public function test_serialize_wraps_component_array(): void {
        $components = [
            ['type' => 'text', 'content' => 'Hello'],
            ['tagName' => 'div', 'content' => 'World'],
        ];

        $result = $this->service->serialize($components);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('components', $result);
        $this->assertEquals($components, $result['components']);
    }

    /**
     * Test serializing empty template returns empty components
     *
     * **Validates: Requirements 10.2**
     */
    public function test_serialize_empty_template_returns_empty_components(): void {
        $result = $this->service->serialize([]);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('components', $result);
        $this->assertEmpty($result['components']);
    }

    /**
     * Test prettyPrint formats HTML with proper indentation
     *
     * **Validates: Requirements 10.3**
     */
    public function test_pretty_print_formats_html_with_indentation(): void {
        $html = '<div><p>Hello</p><p>World</p></div>';

        $result = $this->service->prettyPrint($html);

        $this->assertStringContainsString('<div>', $result);
        $this->assertStringContainsString('  <p>', $result);
        $this->assertStringContainsString('</div>', $result);
    }

    /**
     * Test prettyPrint removes extra whitespace
     *
     * **Validates: Requirements 10.3**
     */
    public function test_pretty_print_removes_extra_whitespace(): void {
        $html = '<div>   <p>  Hello  </p>   </div>';

        $result = $this->service->prettyPrint($html);

        // Check that the result is properly formatted with newlines
        $this->assertStringContainsString('<div>', $result);
        $this->assertStringContainsString('<p>', $result);
        $this->assertStringContainsString('Hello', $result);
        // Verify it's not the original messy format
        $this->assertStringNotContainsString('<div>   <p>', $result);
    }

    /**
     * Test toHTML generates HTML from simple text component
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_generates_html_from_text_component(): void {
        $template = [
            'components' => [
                ['type' => 'text', 'content' => 'Hello World'],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertEquals('Hello World', $html);
    }

    /**
     * Test toHTML generates HTML from div component
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_generates_html_from_div_component(): void {
        $template = [
            'components' => [
                [
                    'tagName' => 'div',
                    'content' => 'Hello World',
                ],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertEquals('<div>Hello World</div>', $html);
    }

    /**
     * Test toHTML generates HTML with attributes
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_generates_html_with_attributes(): void {
        $template = [
            'components' => [
                [
                    'tagName'    => 'div',
                    'attributes' => [
                        'id'    => 'test-id',
                        'class' => 'test-class',
                    ],
                    'content' => 'Hello',
                ],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertStringContainsString('id="test-id"', $html);
        $this->assertStringContainsString('class="test-class"', $html);
        $this->assertStringContainsString('Hello', $html);
    }

    /**
     * Test toHTML generates HTML with nested components
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_generates_html_with_nested_components(): void {
        $template = [
            'components' => [
                [
                    'tagName'    => 'div',
                    'components' => [
                        ['tagName' => 'p', 'content' => 'Paragraph 1'],
                        ['tagName' => 'p', 'content' => 'Paragraph 2'],
                    ],
                ],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertStringContainsString('<div>', $html);
        $this->assertStringContainsString('<p>Paragraph 1</p>', $html);
        $this->assertStringContainsString('<p>Paragraph 2</p>', $html);
        $this->assertStringContainsString('</div>', $html);
    }

    /**
     * Test toHTML handles self-closing tags
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_handles_self_closing_tags(): void {
        $template = [
            'components' => [
                [
                    'tagName'    => 'img',
                    'attributes' => [
                        'src' => 'image.jpg',
                        'alt' => 'Test Image',
                    ],
                ],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertStringContainsString('<img', $html);
        $this->assertStringContainsString('src="image.jpg"', $html);
        $this->assertStringContainsString('alt="Test Image"', $html);
        $this->assertStringContainsString('/>', $html);
    }

    /**
     * Test toHTML escapes HTML in attributes
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_escapes_html_in_attributes(): void {
        $template = [
            'components' => [
                [
                    'tagName'    => 'div',
                    'attributes' => [
                        'data-value' => '<script>alert("xss")</script>',
                    ],
                    'content' => 'Safe content',
                ],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
    }

    /**
     * Test toHTML generates HTML with inline styles
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_generates_html_with_inline_styles(): void {
        $template = [
            'components' => [
                [
                    'tagName' => 'div',
                    'styles'  => [
                        'color'      => 'red',
                        'font-size'  => '16px',
                        'text-align' => 'center',
                    ],
                    'content' => 'Styled text',
                ],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertStringContainsString('style=', $html);
        $this->assertStringContainsString('color: red', $html);
        $this->assertStringContainsString('font-size: 16px', $html);
        $this->assertStringContainsString('text-align: center', $html);
    }

    /**
     * Test toHTML generates HTML with classes array
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_generates_html_with_classes_array(): void {
        $template = [
            'components' => [
                [
                    'tagName' => 'div',
                    'classes' => ['class-1', 'class-2', 'class-3'],
                    'content' => 'Classed element',
                ],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertStringContainsString('class="class-1 class-2 class-3"', $html);
    }

    /**
     * Test toCSS generates CSS from styles array
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_css_generates_css_from_styles(): void {
        $template = [
            'styles' => [
                [
                    'selectors' => '.test-class',
                    'style'     => [
                        'color'     => 'blue',
                        'font-size' => '14px',
                    ],
                ],
            ],
        ];

        $css = $this->service->toCSS($template);

        $this->assertStringContainsString('.test-class', $css);
        $this->assertStringContainsString('color: blue;', $css);
        $this->assertStringContainsString('font-size: 14px;', $css);
    }

    /**
     * Test toCSS generates CSS with multiple selectors
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_css_generates_css_with_multiple_selectors(): void {
        $template = [
            'styles' => [
                [
                    'selectors' => ['.class-1', '.class-2'],
                    'style'     => [
                        'margin' => '10px',
                    ],
                ],
            ],
        ];

        $css = $this->service->toCSS($template);

        $this->assertStringContainsString('.class-1, .class-2', $css);
        $this->assertStringContainsString('margin: 10px;', $css);
    }

    /**
     * Test toCSS returns empty string for template without styles
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_css_returns_empty_for_template_without_styles(): void {
        $template = [
            'components' => [
                ['type' => 'text', 'content' => 'No styles'],
            ],
        ];

        $css = $this->service->toCSS($template);

        $this->assertEmpty($css);
    }

    /**
     * Test round-trip: serialize then toHTML produces valid output
     *
     * **Validates: Requirements 10.4**
     */
    public function test_round_trip_serialize_and_to_html(): void {
        $template = [
            'components' => [
                [
                    'tagName'    => 'div',
                    'attributes' => ['id' => 'container'],
                    'components' => [
                        ['tagName' => 'h1', 'content' => 'Title'],
                        ['tagName' => 'p', 'content' => 'Content'],
                    ],
                ],
            ],
        ];

        $serialized = $this->service->serialize($template);
        $html       = $this->service->toHTML($serialized);

        $this->assertStringContainsString('<div', $html);
        $this->assertStringContainsString('id="container"', $html);
        $this->assertStringContainsString('<h1>Title</h1>', $html);
        $this->assertStringContainsString('<p>Content</p>', $html);
        $this->assertStringContainsString('</div>', $html);
    }

    /**
     * Test toHTML handles textnode type
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_handles_textnode_type(): void {
        $template = [
            'components' => [
                ['type' => 'textnode', 'content' => 'Plain text node'],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertEquals('Plain text node', $html);
    }

    /**
     * Test toHTML handles boolean attributes
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_handles_boolean_attributes(): void {
        $template = [
            'components' => [
                [
                    'tagName'    => 'input',
                    'attributes' => [
                        'type'     => 'checkbox',
                        'checked'  => true,
                        'disabled' => false,
                    ],
                ],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertStringContainsString('checked', $html);
        $this->assertStringNotContainsString('disabled', $html);
    }

    /**
     * Test toHTML preserves Handlebar tokens in content
     *
     * **Validates: Requirements 10.6**
     */
    public function test_to_html_preserves_handlebar_tokens(): void {
        $template = [
            'components' => [
                [
                    'tagName' => 'div',
                    'content' => '{{doc.customerName}}',
                ],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertStringContainsString('{{doc.customerName}}', $html);
    }

    /**
     * Test toHTML handles complex nested structure
     *
     * **Validates: Requirements 10.2**
     */
    public function test_to_html_handles_complex_nested_structure(): void {
        $template = [
            'components' => [
                [
                    'tagName'    => 'table',
                    'components' => [
                        [
                            'tagName'    => 'thead',
                            'components' => [
                                [
                                    'tagName'    => 'tr',
                                    'components' => [
                                        ['tagName' => 'th', 'content' => 'Header 1'],
                                        ['tagName' => 'th', 'content' => 'Header 2'],
                                    ],
                                ],
                            ],
                        ],
                        [
                            'tagName'    => 'tbody',
                            'components' => [
                                [
                                    'tagName'    => 'tr',
                                    'components' => [
                                        ['tagName' => 'td', 'content' => 'Cell 1'],
                                        ['tagName' => 'td', 'content' => 'Cell 2'],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $html = $this->service->toHTML($template);

        $this->assertStringContainsString('<table>', $html);
        $this->assertStringContainsString('<thead>', $html);
        $this->assertStringContainsString('<tbody>', $html);
        $this->assertStringContainsString('<th>Header 1</th>', $html);
        $this->assertStringContainsString('<td>Cell 1</td>', $html);
    }
}

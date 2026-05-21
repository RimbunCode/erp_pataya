<?php

namespace Tests\Unit\Services\Core\PrintTemplate;

use App\Services\Core\PrintTemplate\HTMLSanitizerService;
use App\Services\Core\PrintTemplate\SanitizationResult;
use Tests\TestCase;

class HTMLSanitizerServiceTest extends TestCase {
    protected HTMLSanitizerService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new HTMLSanitizerService;
    }

    /**
     * Test sanitize returns SanitizationResult instance
     *
     * **Validates: Requirements 6.3**
     */
    public function test_sanitize_returns_sanitization_result(): void {
        $html   = '<div>Safe content</div>';
        $result = $this->service->sanitize($html);

        $this->assertInstanceOf(SanitizationResult::class, $result);
    }

    /**
     * Test sanitize allows safe HTML tags
     *
     * **Validates: Requirements 6.5**
     */
    public function test_sanitize_allows_safe_html_tags(): void {
        $html = '<div><span>Text</span><p>Paragraph</p><h1>Heading</h1></div>';
        $html .= '<table><tr><td>Cell</td></tr></table>';
        $html .= '<ul><li>Item</li></ul><ol><li>Item</li></ol>';
        $html .= '<a href="#">Link</a><img src="image.jpg" alt="Image">';
        $html .= '<strong>Bold</strong><em>Italic</em><br>';

        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('<div>', $result->sanitizedHTML);
        $this->assertStringContainsString('<span>', $result->sanitizedHTML);
        $this->assertStringContainsString('<p>', $result->sanitizedHTML);
        $this->assertStringContainsString('<h1>', $result->sanitizedHTML);
        $this->assertStringContainsString('<table>', $result->sanitizedHTML);
        $this->assertStringContainsString('<ul>', $result->sanitizedHTML);
        $this->assertStringContainsString('<a', $result->sanitizedHTML);
        $this->assertStringContainsString('<img', $result->sanitizedHTML);
        $this->assertStringContainsString('<strong>', $result->sanitizedHTML);
        $this->assertStringContainsString('<em>', $result->sanitizedHTML);
        $this->assertEmpty($result->removedTags);
    }

    /**
     * Test sanitize removes dangerous script tags
     *
     * **Validates: Requirements 6.3**
     */
    public function test_sanitize_removes_script_tags(): void {
        $html   = '<div>Safe content</div><script>alert("XSS")</script>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('<script>', $result->sanitizedHTML);
        $this->assertStringNotContainsString('alert', $result->sanitizedHTML);
        $this->assertContains('script', $result->removedTags);
        $this->assertNotEmpty($result->warnings);
    }

    /**
     * Test sanitize removes dangerous iframe tags
     *
     * **Validates: Requirements 6.3**
     */
    public function test_sanitize_removes_iframe_tags(): void {
        $html   = '<div>Content</div><iframe src="evil.com"></iframe>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('<iframe>', $result->sanitizedHTML);
        $this->assertContains('iframe', $result->removedTags);
    }

    /**
     * Test sanitize removes dangerous object tags
     *
     * **Validates: Requirements 6.3**
     */
    public function test_sanitize_removes_object_tags(): void {
        $html   = '<div>Content</div><object data="evil.swf"></object>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('<object>', $result->sanitizedHTML);
        $this->assertContains('object', $result->removedTags);
    }

    /**
     * Test sanitize removes dangerous embed tags
     *
     * **Validates: Requirements 6.3**
     */
    public function test_sanitize_removes_embed_tags(): void {
        $html   = '<div>Content</div><embed src="evil.swf">';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('<embed>', $result->sanitizedHTML);
        $this->assertContains('embed', $result->removedTags);
    }

    /**
     * Test sanitize removes dangerous form tags
     *
     * **Validates: Requirements 6.3**
     */
    public function test_sanitize_removes_form_tags(): void {
        $html   = '<div>Content</div><form action="evil.php"><input type="text"></form>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('<form>', $result->sanitizedHTML);
        $this->assertStringNotContainsString('<input>', $result->sanitizedHTML);
        $this->assertContains('form', $result->removedTags);
        // Note: input is removed as a child of form, so it may or may not be in removedTags
        // The important thing is that it's not in the output
    }

    /**
     * Test sanitize removes dangerous button tags
     *
     * **Validates: Requirements 6.3**
     */
    public function test_sanitize_removes_button_tags(): void {
        $html   = '<div>Content</div><button onclick="alert()">Click</button>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('<button>', $result->sanitizedHTML);
        $this->assertContains('button', $result->removedTags);
    }

    /**
     * Test sanitize allows safe attributes
     *
     * **Validates: Requirements 6.6**
     */
    public function test_sanitize_allows_safe_attributes(): void {
        $html = '<div class="container" id="main" style="color: red;" title="Title">Content</div>';
        $html .= '<a href="https://example.com">Link</a>';
        $html .= '<img src="image.jpg" alt="Image" title="Image Title">';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('class="container"', $result->sanitizedHTML);
        $this->assertStringContainsString('id="main"', $result->sanitizedHTML);
        $this->assertStringContainsString('style="color: red;"', $result->sanitizedHTML);
        $this->assertStringContainsString('title="Title"', $result->sanitizedHTML);
        $this->assertStringContainsString('href="https://example.com"', $result->sanitizedHTML);
        $this->assertStringContainsString('src="image.jpg"', $result->sanitizedHTML);
        $this->assertStringContainsString('alt="Image"', $result->sanitizedHTML);
        $this->assertEmpty($result->removedAttributes);
    }

    /**
     * Test sanitize removes onclick attributes
     *
     * **Validates: Requirements 6.4**
     */
    public function test_sanitize_removes_onclick_attributes(): void {
        $html   = '<div onclick="alert(\'XSS\')">Click me</div>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('onclick', $result->sanitizedHTML);
        $this->assertContains('onclick', $result->removedAttributes);
    }

    /**
     * Test sanitize removes onerror attributes
     *
     * **Validates: Requirements 6.4**
     */
    public function test_sanitize_removes_onerror_attributes(): void {
        $html   = '<img src="x" onerror="alert(\'XSS\')">';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('onerror', $result->sanitizedHTML);
        $this->assertContains('onerror', $result->removedAttributes);
    }

    /**
     * Test sanitize removes onload attributes
     *
     * **Validates: Requirements 6.4**
     */
    public function test_sanitize_removes_onload_attributes(): void {
        $html   = '<body onload="alert(\'XSS\')">Content</body>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('onload', $result->sanitizedHTML);
    }

    /**
     * Test sanitize removes all on* event attributes
     *
     * **Validates: Requirements 6.4**
     */
    public function test_sanitize_removes_all_event_attributes(): void {
        $html   = '<div onmouseover="alert()" onmouseout="alert()" onfocus="alert()">Content</div>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('onmouseover', $result->sanitizedHTML);
        $this->assertStringNotContainsString('onmouseout', $result->sanitizedHTML);
        $this->assertStringNotContainsString('onfocus', $result->sanitizedHTML);
    }

    /**
     * Test sanitize removes javascript: protocol in href
     *
     * **Validates: Requirements 6.4**
     */
    public function test_sanitize_removes_javascript_protocol_in_href(): void {
        $html   = '<a href="javascript:alert(\'XSS\')">Click</a>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('javascript:', $result->sanitizedHTML);
        $this->assertContains('href', $result->removedAttributes);
    }

    /**
     * Test sanitize removes javascript: protocol in src
     *
     * **Validates: Requirements 6.4**
     */
    public function test_sanitize_removes_javascript_protocol_in_src(): void {
        $html   = '<img src="javascript:alert(\'XSS\')">';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('javascript:', $result->sanitizedHTML);
        $this->assertContains('src', $result->removedAttributes);
    }

    /**
     * Test sanitize allows valid http URLs
     *
     * **Validates: Requirements 6.6**
     */
    public function test_sanitize_allows_valid_http_urls(): void {
        $html   = '<a href="http://example.com">Link</a>';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('href="http://example.com"', $result->sanitizedHTML);
        $this->assertEmpty($result->removedAttributes);
    }

    /**
     * Test sanitize allows valid https URLs
     *
     * **Validates: Requirements 6.6**
     */
    public function test_sanitize_allows_valid_https_urls(): void {
        $html   = '<a href="https://example.com">Link</a>';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('href="https://example.com"', $result->sanitizedHTML);
        $this->assertEmpty($result->removedAttributes);
    }

    /**
     * Test sanitize allows relative URLs
     *
     * **Validates: Requirements 6.6**
     */
    public function test_sanitize_allows_relative_urls(): void {
        $html   = '<a href="/path/to/page">Link</a><img src="../image.jpg">';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('href="/path/to/page"', $result->sanitizedHTML);
        $this->assertStringContainsString('src="../image.jpg"', $result->sanitizedHTML);
        $this->assertEmpty($result->removedAttributes);
    }

    /**
     * Test sanitize allows mailto URLs
     *
     * **Validates: Requirements 6.6**
     */
    public function test_sanitize_allows_mailto_urls(): void {
        $html   = '<a href="mailto:test@example.com">Email</a>';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('href="mailto:test@example.com"', $result->sanitizedHTML);
        $this->assertEmpty($result->removedAttributes);
    }

    /**
     * Test sanitize allows tel URLs
     *
     * **Validates: Requirements 6.6**
     */
    public function test_sanitize_allows_tel_urls(): void {
        $html   = '<a href="tel:+1234567890">Call</a>';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('href="tel:+1234567890"', $result->sanitizedHTML);
        $this->assertEmpty($result->removedAttributes);
    }

    /**
     * Test sanitize removes data: protocol with script
     *
     * **Validates: Requirements 6.4**
     */
    public function test_sanitize_removes_data_protocol_with_script(): void {
        $html   = '<img src="data:text/html,<script>alert(\'XSS\')</script>">';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('data:text/html', $result->sanitizedHTML);
        $this->assertContains('src', $result->removedAttributes);
    }

    /**
     * Test isSafe returns true for safe HTML
     *
     * **Validates: Requirements 6.3**
     */
    public function test_is_safe_returns_true_for_safe_html(): void {
        $html = '<div class="container"><p>Safe content</p></div>';

        $this->assertTrue($this->service->isSafe($html));
    }

    /**
     * Test isSafe returns false for dangerous HTML
     *
     * **Validates: Requirements 6.3**
     */
    public function test_is_safe_returns_false_for_dangerous_html(): void {
        $html = '<div>Content</div><script>alert("XSS")</script>';

        $this->assertFalse($this->service->isSafe($html));
    }

    /**
     * Test isSafe returns false for HTML with dangerous attributes
     *
     * **Validates: Requirements 6.4**
     */
    public function test_is_safe_returns_false_for_dangerous_attributes(): void {
        $html = '<div onclick="alert()">Content</div>';

        $this->assertFalse($this->service->isSafe($html));
    }

    /**
     * Test getRemovedElements returns tags and attributes
     *
     * **Validates: Requirements 6.7**
     */
    public function test_get_removed_elements_returns_tags_and_attributes(): void {
        $html = '<div onclick="alert()">Content</div><script>alert()</script>';

        $removed = $this->service->getRemovedElements($html);

        $this->assertArrayHasKey('tags', $removed);
        $this->assertArrayHasKey('attributes', $removed);
        $this->assertContains('script', $removed['tags']);
        $this->assertContains('onclick', $removed['attributes']);
    }

    /**
     * Test getRemovedElements returns empty arrays for safe HTML
     *
     * **Validates: Requirements 6.7**
     */
    public function test_get_removed_elements_returns_empty_for_safe_html(): void {
        $html = '<div class="container"><p>Safe content</p></div>';

        $removed = $this->service->getRemovedElements($html);

        $this->assertEmpty($removed['tags']);
        $this->assertEmpty($removed['attributes']);
    }

    /**
     * Test sanitize generates warnings for removed content
     *
     * **Validates: Requirements 6.7**
     */
    public function test_sanitize_generates_warnings_for_removed_content(): void {
        $html   = '<div>Content</div><script>alert()</script><div onclick="alert()">Click</div>';
        $result = $this->service->sanitize($html);

        $this->assertNotEmpty($result->warnings);
        $this->assertCount(2, $result->warnings);
        $this->assertStringContainsString('script', $result->warnings[0]);
        $this->assertStringContainsString('onclick', $result->warnings[1]);
    }

    /**
     * Test sanitize handles empty HTML
     *
     * **Validates: Requirements 6.3**
     */
    public function test_sanitize_handles_empty_html(): void {
        $html   = '';
        $result = $this->service->sanitize($html);

        $this->assertEmpty($result->sanitizedHTML);
        $this->assertEmpty($result->warnings);
    }

    /**
     * Test sanitize handles nested dangerous tags
     *
     * **Validates: Requirements 6.3**
     */
    public function test_sanitize_handles_nested_dangerous_tags(): void {
        $html   = '<div><div><script>alert()</script></div></div>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('<script>', $result->sanitizedHTML);
        $this->assertContains('script', $result->removedTags);
    }

    /**
     * Test sanitize preserves text content
     *
     * **Validates: Requirements 6.5**
     */
    public function test_sanitize_preserves_text_content(): void {
        $html   = '<div>This is safe text content</div>';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('This is safe text content', $result->sanitizedHTML);
    }

    /**
     * Test sanitize handles multiple dangerous elements
     *
     * **Validates: Requirements 6.3, 6.4**
     */
    public function test_sanitize_handles_multiple_dangerous_elements(): void {
        $html = '<div onclick="alert()">Content</div>';
        $html .= '<script>alert()</script>';
        $html .= '<iframe src="evil.com"></iframe>';
        $html .= '<a href="javascript:alert()">Link</a>';

        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('<script>', $result->sanitizedHTML);
        $this->assertStringNotContainsString('<iframe>', $result->sanitizedHTML);
        $this->assertStringNotContainsString('onclick', $result->sanitizedHTML);
        $this->assertStringNotContainsString('javascript:', $result->sanitizedHTML);
        $this->assertNotEmpty($result->removedTags);
        $this->assertNotEmpty($result->removedAttributes);
    }

    /**
     * Test sanitize handles UTF-8 characters
     *
     * **Validates: Requirements 6.5**
     */
    public function test_sanitize_handles_utf8_characters(): void {
        $html   = '<div>Héllo Wörld 你好 مرحبا</div>';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('Héllo Wörld', $result->sanitizedHTML);
        $this->assertStringContainsString('你好', $result->sanitizedHTML);
        $this->assertStringContainsString('مرحبا', $result->sanitizedHTML);
    }

    /**
     * Test sanitize removes unallowed tags
     *
     * **Validates: Requirements 6.5**
     */
    public function test_sanitize_removes_unallowed_tags(): void {
        $html   = '<div>Content</div><video src="video.mp4"></video><audio src="audio.mp3"></audio>';
        $result = $this->service->sanitize($html);

        $this->assertStringNotContainsString('<video>', $result->sanitizedHTML);
        $this->assertStringNotContainsString('<audio>', $result->sanitizedHTML);
        $this->assertContains('video', $result->removedTags);
        $this->assertContains('audio', $result->removedTags);
    }

    /**
     * Test sanitize allows all heading levels
     *
     * **Validates: Requirements 6.5**
     */
    public function test_sanitize_allows_all_heading_levels(): void {
        $html   = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('<h1>', $result->sanitizedHTML);
        $this->assertStringContainsString('<h2>', $result->sanitizedHTML);
        $this->assertStringContainsString('<h3>', $result->sanitizedHTML);
        $this->assertStringContainsString('<h4>', $result->sanitizedHTML);
        $this->assertStringContainsString('<h5>', $result->sanitizedHTML);
        $this->assertStringContainsString('<h6>', $result->sanitizedHTML);
        $this->assertEmpty($result->removedTags);
    }

    /**
     * Test sanitize allows table elements
     *
     * **Validates: Requirements 6.5**
     */
    public function test_sanitize_allows_table_elements(): void {
        $html   = '<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('<table>', $result->sanitizedHTML);
        $this->assertStringContainsString('<tr>', $result->sanitizedHTML);
        $this->assertStringContainsString('<th>', $result->sanitizedHTML);
        $this->assertStringContainsString('<td>', $result->sanitizedHTML);
        $this->assertEmpty($result->removedTags);
    }

    /**
     * Test sanitize allows list elements
     *
     * **Validates: Requirements 6.5**
     */
    public function test_sanitize_allows_list_elements(): void {
        $html   = '<ul><li>Item 1</li></ul><ol><li>Item 2</li></ol>';
        $result = $this->service->sanitize($html);

        $this->assertStringContainsString('<ul>', $result->sanitizedHTML);
        $this->assertStringContainsString('<ol>', $result->sanitizedHTML);
        $this->assertStringContainsString('<li>', $result->sanitizedHTML);
        $this->assertEmpty($result->removedTags);
    }
}

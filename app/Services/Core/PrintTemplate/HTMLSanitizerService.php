<?php

namespace App\Services\Core\PrintTemplate;

/**
 * Service for sanitizing user-provided HTML to prevent XSS and injection attacks
 *
 * This service uses a whitelist approach to allow only safe HTML tags and attributes,
 * removing dangerous content that could pose security risks.
 */
class HTMLSanitizerService {
    /**
     * Allowed HTML tags (whitelist)
     */
    protected array $allowedTags = [
        'div',
        'span',
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'table',
        'tr',
        'td',
        'th',
        'ul',
        'ol',
        'li',
        'a',
        'img',
        'strong',
        'em',
        'br',
    ];

    /**
     * Allowed HTML attributes (whitelist)
     */
    protected array $allowedAttributes = [
        'class',
        'id',
        'style',
        'href',
        'src',
        'alt',
        'title',
    ];

    /**
     * Dangerous tags that should be blocked
     */
    protected array $dangerousTags = [
        'script',
        'iframe',
        'object',
        'embed',
        'form',
        'input',
        'button',
    ];

    /**
     * Dangerous attribute patterns that should be blocked
     */
    protected array $dangerousAttributePatterns = [
        '/^on\w+/i',        // onclick, onerror, onload, etc.
        '/javascript:/i',   // javascript: protocol
    ];

    /**
     * Sanitize HTML content
     *
     * Removes dangerous tags and attributes while preserving safe content.
     * Returns a SanitizationResult with the sanitized HTML and warnings.
     *
     * @param  string  $html  Raw HTML content to sanitize
     * @return SanitizationResult Sanitization result with cleaned HTML and warnings
     */
    public function sanitize(string $html): SanitizationResult {
        $warnings          = [];
        $removedTags       = [];
        $removedAttributes = [];

        // Handle empty HTML
        if (empty(\trim($html))) {
            return new SanitizationResult(
                sanitizedHTML: '',
                warnings: [],
                removedTags: [],
                removedAttributes: [],
            );
        }

        // Load HTML into DOMDocument
        $dom = new \DOMDocument('1.0', 'UTF-8');
        \libxml_use_internal_errors(true);

        // Wrap in a temporary container to preserve structure
        $wrappedHTML = '<div>' . $html . '</div>';
        $dom->loadHTML('<?xml encoding="UTF-8">' . $wrappedHTML, \LIBXML_HTML_NOIMPLIED | \LIBXML_HTML_NODEFDTD);
        \libxml_clear_errors();

        // Process all elements starting from the wrapper
        $wrapper = $dom->documentElement;
        if ($wrapper !== null) {
            $this->processNode($wrapper, $removedTags, $removedAttributes);
        }

        // Get sanitized HTML from wrapper's children
        $sanitizedHTML = '';
        if ($wrapper !== null && $wrapper->hasChildNodes()) {
            foreach ($wrapper->childNodes as $child) {
                $sanitizedHTML .= $dom->saveHTML($child);
            }
        }

        // Generate warnings
        if (! empty($removedTags)) {
            $warnings[] = 'Removed dangerous tags: ' . \implode(', ', \array_unique($removedTags));
        }

        if (! empty($removedAttributes)) {
            $warnings[] = 'Removed dangerous attributes: ' . \implode(', ', \array_unique($removedAttributes));
        }

        return new SanitizationResult(
            sanitizedHTML: $sanitizedHTML,
            warnings: $warnings,
            removedTags: \array_unique($removedTags),
            removedAttributes: \array_unique($removedAttributes),
        );
    }

    /**
     * Check if HTML is safe
     *
     * Returns true if the HTML contains no dangerous content.
     *
     * @param  string  $html  HTML content to check
     * @return bool True if HTML is safe
     */
    public function isSafe(string $html): bool {
        $result = $this->sanitize($html);

        return empty($result->removedTags) && empty($result->removedAttributes);
    }

    /**
     * Get list of removed elements
     *
     * Returns an array of tags and attributes that would be removed from the HTML.
     *
     * @param  string  $html  HTML content to analyze
     * @return array Array with 'tags' and 'attributes' keys
     */
    public function getRemovedElements(string $html): array {
        $result = $this->sanitize($html);

        return [
            'tags'       => $result->removedTags,
            'attributes' => $result->removedAttributes,
        ];
    }

    /**
     * Process a DOM node and its children recursively
     *
     * Removes dangerous tags and attributes from the node tree.
     *
     * @param  \DOMNode|null  $node  Node to process
     * @param  array  $removedTags  Array to collect removed tag names
     * @param  array  $removedAttributes  Array to collect removed attribute names
     */
    protected function processNode(?\DOMNode $node, array &$removedTags, array &$removedAttributes): void {
        if ($node === null) {
            return;
        }

        // Process element nodes
        if ($node->nodeType === \XML_ELEMENT_NODE) {
            $tagName = \strtolower($node->nodeName);

            // Check if tag is dangerous
            if (\in_array($tagName, $this->dangerousTags)) {
                $removedTags[] = $tagName;
                $node->parentNode?->removeChild($node);

                return;
            }

            // Check if tag is allowed
            if (! \in_array($tagName, $this->allowedTags)) {
                $removedTags[] = $tagName;
                $node->parentNode?->removeChild($node);

                return;
            }

            // Process attributes
            if ($node->hasAttributes()) {
                $attributesToRemove = [];

                foreach ($node->attributes as $attribute) {
                    $attrName = \strtolower($attribute->name);

                    // Check if attribute is allowed
                    if (! \in_array($attrName, $this->allowedAttributes)) {
                        $attributesToRemove[] = $attrName;
                        $removedAttributes[]  = $attrName;

                        continue;
                    }

                    // Check for dangerous attribute patterns
                    foreach ($this->dangerousAttributePatterns as $pattern) {
                        if (\preg_match($pattern, $attrName) || \preg_match($pattern, $attribute->value)) {
                            $attributesToRemove[] = $attrName;
                            $removedAttributes[]  = $attrName;

                            break;
                        }
                    }

                    // Validate URLs in href and src attributes
                    if (\in_array($attrName, ['href', 'src'])) {
                        if (! $this->isValidUrl($attribute->value)) {
                            $attributesToRemove[] = $attrName;
                            $removedAttributes[]  = $attrName;
                        }
                    }
                }

                // Remove dangerous attributes
                foreach ($attributesToRemove as $attrName) {
                    $node->removeAttribute($attrName);
                }
            }
        }

        // Process child nodes
        if ($node->hasChildNodes()) {
            $children = [];

            foreach ($node->childNodes as $child) {
                $children[] = $child;
            }

            foreach ($children as $child) {
                $this->processNode($child, $removedTags, $removedAttributes);
            }
        }
    }

    /**
     * Validate URL for href and src attributes
     *
     * Checks if the URL is safe and doesn't contain dangerous protocols.
     *
     * @param  string  $url  URL to validate
     * @return bool True if URL is valid and safe
     */
    protected function isValidUrl(string $url): bool {
        // Empty URLs are allowed (for relative paths)
        if (empty($url)) {
            return true;
        }

        // Check for javascript: protocol
        if (\preg_match('/^\s*javascript:/i', $url)) {
            return false;
        }

        // Check for data: protocol with script content
        if (\preg_match('/^\s*data:.*script/i', $url)) {
            return false;
        }

        // Allow relative URLs, http, https, mailto, tel
        if (\preg_match('/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i', $url)) {
            return true;
        }

        // Allow URLs without protocol (relative paths)
        if (! \preg_match('/^[a-z]+:/i', $url)) {
            return true;
        }

        return false;
    }
}

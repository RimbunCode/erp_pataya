<?php

namespace App\Services\Core\PrintTemplate;

/**
 * Service for serializing and reconstructing GrapeJS templates
 *
 * This service handles converting stored JSON template data back into
 * GrapeJS component structures and generating formatted HTML/CSS output.
 */
class TemplateSerializerService {
    /**
     * Serialize JSON to GrapeJS components
     *
     * Reconstructs the GrapeJS component tree from stored JSON structure.
     * This is the inverse operation of template parsing.
     *
     * @param  array  $template  Template data structure (JSON decoded)
     * @return array GrapeJS component structure
     */
    public function serialize(array $template): array {
        // If template is already in component format, return as-is
        if (isset($template['components'])) {
            return $template;
        }

        // If template is a simple array of components, wrap it
        if ($this->isComponentArray($template)) {
            return [
                'components' => $template,
            ];
        }

        // Return empty structure if template is invalid
        return [
            'components' => [],
        ];
    }

    /**
     * Format HTML with proper indentation
     *
     * Takes raw HTML and formats it with proper indentation and line breaks
     * for better readability.
     *
     * @param  string  $html  Raw HTML content
     * @return string Formatted HTML with indentation
     */
    public function prettyPrint(string $html): string {
        // Remove extra whitespace and newlines
        $html = \preg_replace('/\s+/', ' ', $html);
        $html = \trim($html);

        // Add newlines after closing tags
        $html = \preg_replace('/>/', ">\n", $html);

        // Add newlines before opening tags
        $html = \preg_replace('/</', "\n<", $html);

        // Remove empty lines
        $html = \preg_replace('/\n\s*\n/', "\n", $html);

        // Split into lines for indentation
        $lines    = \explode("\n", $html);
        $indented = [];
        $indent   = 0;

        foreach ($lines as $line) {
            $line = \trim($line);

            if (empty($line)) {
                continue;
            }

            // Decrease indent for closing tags
            if (\preg_match('/^<\//', $line)) {
                $indent = \max(0, $indent - 1);
            }

            // Add indented line
            $indented[] = \str_repeat('  ', $indent) . $line;

            // Increase indent for opening tags (but not self-closing or closing tags)
            if (\preg_match('/^<[^\/]/', $line) && ! \preg_match('/\/>$/', $line) && ! \preg_match('/<\/[^>]+>$/', $line)) {
                $indent++;
            }
        }

        return \implode("\n", $indented);
    }

    /**
     * Generate HTML from template
     *
     * Converts the template structure into HTML string.
     * This processes the component tree and generates the final HTML output.
     *
     * @param  array  $template  Template data structure
     * @return string Generated HTML
     */
    public function toHTML(array $template): string {
        // If template has components, process them
        if (isset($template['components'])) {
            return $this->componentsToHTML($template['components']);
        }

        // If template is a component array, process it
        if ($this->isComponentArray($template)) {
            return $this->componentsToHTML($template);
        }

        return '';
    }

    /**
     * Generate CSS from template
     *
     * Extracts and generates CSS from the template structure.
     * This processes component styles and generates the final CSS output.
     *
     * @param  array  $template  Template data structure
     * @return string Generated CSS
     */
    public function toCSS(array $template): string {
        $css = [];

        // Extract styles from template
        if (isset($template['styles'])) {
            $css[] = $this->stylesToCSS($template['styles']);
        }

        // Extract styles from components
        if (isset($template['components'])) {
            $css[] = $this->extractComponentStyles($template['components']);
        }

        // If template is a component array, extract styles
        if ($this->isComponentArray($template)) {
            $css[] = $this->extractComponentStyles($template);
        }

        return \implode("\n", \array_filter($css));
    }

    /**
     * Check if array is a component array
     *
     * @param  array  $array  Array to check
     * @return bool True if array contains components
     */
    protected function isComponentArray(array $array): bool {
        if (empty($array)) {
            return false;
        }

        // Check if first element looks like a component
        $first = \reset($array);

        return \is_array($first) && (
            isset($first['type']) ||
      isset($first['tagName']) ||
      isset($first['components'])
        );
    }

    /**
     * Convert components array to HTML
     *
     * @param  array  $components  Array of components
     * @return string Generated HTML
     */
    protected function componentsToHTML(array $components): string {
        $html = [];

        foreach ($components as $component) {
            $html[] = $this->componentToHTML($component);
        }

        return \implode('', $html);
    }

    /**
     * Convert single component to HTML
     *
     * @param  array  $component  Component data
     * @return string Generated HTML
     */
    protected function componentToHTML(array $component): string {
        // Handle text nodes
        if (isset($component['type']) && $component['type'] === 'text') {
            return $component['content'] ?? '';
        }

        // Handle textnode type
        if (isset($component['type']) && $component['type'] === 'textnode') {
            return $component['content'] ?? '';
        }

        // Get tag name
        $tagName = $component['tagName'] ?? $component['type'] ?? 'div';

        // Build attributes
        $attributes = $this->buildAttributes($component);

        // Get content
        $content = '';
        if (isset($component['content'])) {
            $content = $component['content'];
        } elseif (isset($component['components'])) {
            $content = $this->componentsToHTML($component['components']);
        }

        // Build HTML tag
        if ($this->isSelfClosingTag($tagName)) {
            return "<{$tagName}{$attributes} />";
        }

        return "<{$tagName}{$attributes}>{$content}</{$tagName}>";
    }

    /**
     * Build HTML attributes from component
     *
     * @param  array  $component  Component data
     * @return string Formatted attributes string
     */
    protected function buildAttributes(array $component): string {
        $attributes = [];

        // Add attributes from attributes property
        if (isset($component['attributes']) && \is_array($component['attributes'])) {
            foreach ($component['attributes'] as $key => $value) {
                if (\is_string($value) || \is_numeric($value)) {
                    $attributes[] = $key . '="' . \htmlspecialchars((string) $value, ENT_QUOTES) . '"';
                } elseif (\is_bool($value) && $value) {
                    $attributes[] = $key;
                }
            }
        }

        // Add classes
        if (isset($component['classes']) && \is_array($component['classes'])) {
            $classes = \implode(' ', $component['classes']);
            if (! empty($classes)) {
                $attributes[] = 'class="' . \htmlspecialchars($classes, ENT_QUOTES) . '"';
            }
        }

        // Add inline styles
        if (isset($component['styles']) && \is_array($component['styles'])) {
            $styles = $this->buildInlineStyles($component['styles']);
            if (! empty($styles)) {
                $attributes[] = 'style="' . \htmlspecialchars($styles, ENT_QUOTES) . '"';
            }
        }

        return empty($attributes) ? '' : ' ' . \implode(' ', $attributes);
    }

    /**
     * Build inline styles string
     *
     * @param  array  $styles  Styles array
     * @return string Formatted inline styles
     */
    protected function buildInlineStyles(array $styles): string {
        $styleStrings = [];

        foreach ($styles as $property => $value) {
            if (! empty($value)) {
                $styleStrings[] = "{$property}: {$value}";
            }
        }

        return \implode('; ', $styleStrings);
    }

    /**
     * Check if tag is self-closing
     *
     * @param  string  $tagName  Tag name
     * @return bool True if self-closing
     */
    protected function isSelfClosingTag(string $tagName): bool {
        $selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];

        return \in_array(\strtolower($tagName), $selfClosingTags);
    }

    /**
     * Convert styles array to CSS
     *
     * @param  array  $styles  Styles definition
     * @return string Generated CSS
     */
    protected function stylesToCSS(array $styles): string {
        $css = [];

        foreach ($styles as $style) {
            if (isset($style['selectors']) && isset($style['style'])) {
                $selectors = \is_array($style['selectors']) ? \implode(', ', $style['selectors']) : $style['selectors'];
                $rules     = $this->buildCSSRules($style['style']);

                if (! empty($rules)) {
                    $css[] = "{$selectors} {\n  {$rules}\n}";
                }
            }
        }

        return \implode("\n\n", $css);
    }

    /**
     * Build CSS rules from style object
     *
     * @param  array  $style  Style properties
     * @return string Formatted CSS rules
     */
    protected function buildCSSRules(array $style): string {
        $rules = [];

        foreach ($style as $property => $value) {
            if (! empty($value)) {
                $rules[] = "{$property}: {$value};";
            }
        }

        return \implode("\n  ", $rules);
    }

    /**
     * Extract styles from components
     *
     * @param  array  $components  Components array
     * @return string Extracted CSS
     */
    protected function extractComponentStyles(array $components): string {
        $css = [];

        foreach ($components as $component) {
            // Extract component-level styles
            if (isset($component['styles']) && \is_array($component['styles'])) {
                // Component inline styles are handled in HTML generation
                // This is for extracting class-based styles if needed
            }

            // Recursively extract from nested components
            if (isset($component['components']) && \is_array($component['components'])) {
                $nestedCSS = $this->extractComponentStyles($component['components']);
                if (! empty($nestedCSS)) {
                    $css[] = $nestedCSS;
                }
            }
        }

        return \implode("\n", \array_filter($css));
    }
}

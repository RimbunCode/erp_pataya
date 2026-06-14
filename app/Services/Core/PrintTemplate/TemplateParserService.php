<?php

namespace App\Services\Core\PrintTemplate;

/**
 * Service for parsing GrapeJS component trees into storable JSON structures
 *
 * This service handles the conversion of GrapeJS editor data into a format
 * that can be stored in the database, while preserving all component attributes
 * and extracting metadata like Handlebar tokens and relation paths.
 */
class TemplateParserService {
    /**
     * Create a new TemplateParserService instance
     *
     * @param  RelationTrackerService  $relationTracker  Service for tracking relations
     */
    public function __construct(
        protected RelationTrackerService $relationTracker,
    ) {}

    /**
     * Parse GrapeJS components to JSON structure
     *
     * Converts the GrapeJS component tree into a normalized JSON structure
     * suitable for database storage. Preserves all component attributes
     * including data-* attributes.
     *
     * @param  array  $components  GrapeJS component tree
     * @return array Parsed template structure
     */
    public function parse(array $components): array {
        $parsed = [];

        foreach ($components as $component) {
            $parsed[] = $this->parseComponent($component);
        }

        return $parsed;
    }

    /**
     * Parse a single component recursively
     *
     * @param  array  $component  Component data
     * @return array Parsed component
     */
    protected function parseComponent(array $component): array {
        $parsed = [
            'type' => $component['type'] ?? 'default',
        ];

        // Preserve tag name
        if (isset($component['tagName'])) {
            $parsed['tagName'] = $component['tagName'];
        }

        // Preserve all attributes including data-* attributes
        if (isset($component['attributes']) && is_array($component['attributes'])) {
            $parsed['attributes'] = $component['attributes'];
        }

        // Preserve content
        if (isset($component['content'])) {
            $parsed['content'] = $component['content'];
        }

        // Preserve styles
        if (isset($component['styles']) && is_array($component['styles'])) {
            $parsed['styles'] = $component['styles'];
        }

        // Preserve classes
        if (isset($component['classes']) && is_array($component['classes'])) {
            $parsed['classes'] = $component['classes'];
        }

        // Preserve component-specific properties
        if (isset($component['name'])) {
            $parsed['name'] = $component['name'];
        }

        if (isset($component['draggable'])) {
            $parsed['draggable'] = $component['draggable'];
        }

        if (isset($component['droppable'])) {
            $parsed['droppable'] = $component['droppable'];
        }

        if (isset($component['editable'])) {
            $parsed['editable'] = $component['editable'];
        }

        if (isset($component['selectable'])) {
            $parsed['selectable'] = $component['selectable'];
        }

        if (isset($component['highlightable'])) {
            $parsed['highlightable'] = $component['highlightable'];
        }

        if (isset($component['copyable'])) {
            $parsed['copyable'] = $component['copyable'];
        }

        if (isset($component['removable'])) {
            $parsed['removable'] = $component['removable'];
        }

        if (isset($component['resizable'])) {
            $parsed['resizable'] = $component['resizable'];
        }

        // Recursively parse nested components
        if (isset($component['components']) && is_array($component['components'])) {
            $parsed['components'] = $this->parse($component['components']);
        }

        return $parsed;
    }

    /**
     * Extract Handlebar tokens from template
     *
     * Scans the template structure and extracts all Handlebar tokens
     * found in component content and attributes.
     *
     * @param  array  $components  Template component tree
     * @return array Array of unique Handlebar tokens found in template
     */
    public function extractTokens(array $components): array {
        $tokens = [];

        foreach ($components as $component) {
            $tokens = array_merge($tokens, $this->extractTokensFromComponent($component));
        }

        // Remove duplicates and sort
        $tokens = array_unique($tokens);
        sort($tokens);

        return array_values($tokens);
    }

    /**
     * Extract tokens from a single component
     *
     * @param  array  $component  Component data
     * @return array Array of tokens found in component
     */
    protected function extractTokensFromComponent(array $component): array {
        $tokens = [];

        // Extract from content
        if (isset($component['content']) && is_string($component['content'])) {
            $contentTokens = $this->parseTokensFromString($component['content']);
            $tokens        = array_merge($tokens, $contentTokens);
        }

        // Extract from attributes
        if (isset($component['attributes']) && is_array($component['attributes'])) {
            foreach ($component['attributes'] as $value) {
                if (is_string($value)) {
                    $attrTokens = $this->parseTokensFromString($value);
                    $tokens     = array_merge($tokens, $attrTokens);
                }
            }
        }

        // Recursively extract from nested components
        if (isset($component['components']) && is_array($component['components'])) {
            $nestedTokens = $this->extractTokens($component['components']);
            $tokens       = array_merge($tokens, $nestedTokens);
        }

        return $tokens;
    }

    /**
     * Parse Handlebar tokens from a string
     *
     * @param  string  $content  Content to parse
     * @return array Array of tokens found
     */
    protected function parseTokensFromString(string $content): array {
        $tokens = [];

        // Match all Handlebar tokens: {{...}}
        preg_match_all('/\{\{[^}]+\}\}/', $content, $matches);

        if (! empty($matches[0])) {
            $tokens = array_merge($tokens, $matches[0]);
        }

        // Match block helpers: {{#helper}}...{{/helper}}
        preg_match_all('/\{\{[#\/][^}]+\}\}/', $content, $matches);

        if (! empty($matches[0])) {
            $tokens = array_merge($tokens, $matches[0]);
        }

        return $tokens;
    }

    /**
     * Validate template structure
     *
     * Checks if the template structure is valid and returns validation result
     * with any errors or warnings found.
     *
     * @param  array  $template  Template data to validate
     * @return ValidationResult Validation result with errors and warnings
     */
    public function validate(array $template): ValidationResult {
        $errors   = [];
        $warnings = [];

        // Check if template is empty
        if (empty($template)) {
            $warnings[] = 'Template is empty';

            return new ValidationResult(true, $errors, $warnings);
        }

        // Validate component structure
        $this->validateComponents($template, $errors, $warnings);

        // Validate Handlebar tokens
        $this->validateHandlebarTokens($template, $errors, $warnings);

        $isValid = empty($errors);

        return new ValidationResult($isValid, $errors, $warnings);
    }

    /**
     * Validate components recursively
     *
     * @param  array  $components  Components to validate
     * @param  array  $errors  Reference to errors array
     * @param  array  $warnings  Reference to warnings array
     */
    protected function validateComponents(array $components, array &$errors, array &$warnings): void {
        foreach ($components as $index => $component) {
            // Check if component has required type
            if (! isset($component['type'])) {
                $errors[] = "Component at index {$index} is missing 'type' property";
            }

            // Validate attributes if present
            if (isset($component['attributes']) && ! is_array($component['attributes'])) {
                $errors[] = "Component at index {$index} has invalid 'attributes' property (must be array)";
            }

            // Validate nested components
            if (isset($component['components'])) {
                if (! is_array($component['components'])) {
                    $errors[] = "Component at index {$index} has invalid 'components' property (must be array)";
                } else {
                    $this->validateComponents($component['components'], $errors, $warnings);
                }
            }
        }
    }

    /**
     * Validate Handlebar tokens in template
     *
     * @param  array  $template  Template to validate
     * @param  array  $errors  Reference to errors array
     * @param  array  $warnings  Reference to warnings array
     */
    protected function validateHandlebarTokens(array $template, array &$errors, array &$warnings): void {
        $tokens = $this->extractTokens($template);

        foreach ($tokens as $token) {
            // Check for unclosed block helpers
            if (preg_match('/\{\{#([a-zA-Z_][a-zA-Z0-9_]*)\s*/', $token, $matches)) {
                $helper     = $matches[1];
                $closingTag = "{{/{$helper}}}";
                $allTokens  = implode(' ', $tokens);
                $hasClosing = strpos($allTokens, $closingTag) !== false;

                if (! $hasClosing) {
                    $errors[] = "Unclosed block helper: {$token} (missing {$closingTag})";
                }
            }

            // Check for malformed tokens
            if (! preg_match('/^\{\{[#\/]?[a-zA-Z_][a-zA-Z0-9_\.\s"\']*\}\}$/', $token)) {
                $warnings[] = "Potentially malformed token: {$token}";
            }
        }
    }

    /**
     * Extract required relations from template
     *
     * Uses RelationTrackerService to scan the template and extract
     * all relation paths needed for data loading.
     *
     * @param  array  $template  Template data
     * @return array Array of unique relation paths
     */
    public function extractRelations(array $template): array {
        return $this->relationTracker->extractRelations($template);
    }

    /**
     * Parse template and extract relations in one operation
     *
     * Combines parsing and relation extraction for efficiency.
     * Returns both the parsed template and the used relations array.
     *
     * @param  array  $components  GrapeJS component tree
     * @return array Array with 'template' and 'used_relations' keys
     */
    public function parseWithRelations(array $components): array {
        $parsed = $this->parse($components);

        // Wrap parsed components in template structure for relation extraction
        $templateStructure = ['components' => $parsed];
        $relations         = $this->extractRelations($templateStructure);

        return [
            'template'       => $parsed,
            'used_relations' => $relations,
        ];
    }
}

/**
 * Validation result class
 *
 * Encapsulates the result of template validation including
 * validity status, errors, and warnings.
 */
class ValidationResult {
    /**
     * Create a new ValidationResult instance
     *
     * @param  bool  $isValid  Whether the template is valid
     * @param  array  $errors  Array of error messages
     * @param  array  $warnings  Array of warning messages
     */
    public function __construct(
        public bool $isValid,
        public array $errors = [],
        public array $warnings = [],
    ) {}

    /**
     * Check if validation passed
     *
     * @return bool True if template is valid
     */
    public function passed(): bool {
        return $this->isValid;
    }

    /**
     * Check if validation failed
     *
     * @return bool True if template has errors
     */
    public function failed(): bool {
        return ! $this->isValid;
    }

    /**
     * Check if there are warnings
     *
     * @return bool True if there are warnings
     */
    public function hasWarnings(): bool {
        return ! empty($this->warnings);
    }

    /**
     * Get all messages (errors and warnings)
     *
     * @return array Array of all messages
     */
    public function getAllMessages(): array {
        return array_merge($this->errors, $this->warnings);
    }
}

<?php

namespace App\Services\Core\PrintTemplate;

use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Str;

/**
 * Service for tracking and extracting relations used in print templates
 *
 * This service scans templates for Handlebar tokens and extracts relation paths
 * to enable optimized eager loading during preview and print operations.
 */
class RelationTrackerService {
    /**
     * Extract all relation paths from template
     *
     * Scans the template structure and HTML content to identify all relations
     * used in Handlebar tokens. Returns a normalized array of unique relation paths.
     *
     * @param  array|string  $template  Template data structure from GrapeJS or HTML string
     * @return array Array of unique relation paths (e.g., ['customer', 'items.product'])
     */
    public function extractRelations(array|string $template): array {
        $relations = [];

        // If template is a string (HTML), extract directly
        if (is_string($template)) {
            $htmlRelations = $this->extractRelationsFromHTML($template);
            $relations     = array_merge($relations, $htmlRelations);
        } else {
            // Extract from template HTML if available
            if (isset($template['html'])) {
                $htmlRelations = $this->extractRelationsFromHTML($template['html']);
                $relations     = array_merge($relations, $htmlRelations);
            }

            // Extract from template components if available
            if (isset($template['components'])) {
                $componentRelations = $this->extractRelationsFromComponents($template['components']);
                $relations          = array_merge($relations, $componentRelations);
            }
        }

        return $this->normalizeRelations($relations);
    }

    /**
     * Extract relations from HTML content
     *
     * Parses HTML string to find Handlebar tokens and extract relation paths.
     *
     * @param  string  $html  HTML content with Handlebar tokens
     * @return array Array of relation paths found in HTML
     */
    public function extractRelationsFromHTML(string $html): array {
        return $this->parseHandlebarTokens($html);
    }

    /**
     * Extract relations from GrapeJS component tree
     *
     * Recursively traverses component tree to extract relations from
     * component content and nested components.
     *
     * @param  array  $components  Array of GrapeJS components
     * @return array Array of relation paths found in components
     */
    protected function extractRelationsFromComponents(array $components): array {
        $relations = [];

        foreach ($components as $component) {
            // Extract from component content
            if (isset($component['content']) && is_string($component['content'])) {
                $contentRelations = $this->parseHandlebarTokens($component['content']);
                $relations        = array_merge($relations, $contentRelations);
            }

            // Extract from component attributes (data-relations, etc.)
            if (isset($component['attributes'])) {
                $attrRelations = $this->extractRelationsFromAttributes($component['attributes']);
                $relations     = array_merge($relations, $attrRelations);
            }

            // Recursively process nested components
            if (isset($component['components']) && is_array($component['components'])) {
                $nestedRelations = $this->extractRelationsFromComponents($component['components']);
                $relations       = array_merge($relations, $nestedRelations);
            }
        }

        return $relations;
    }

    /**
     * Extract relations from component attributes
     *
     * @param  array  $attributes  Component attributes
     * @return array Array of relation paths
     */
    protected function extractRelationsFromAttributes(array $attributes): array {
        $relations = [];

        // Check for data-relations attribute
        if (isset($attributes['data-relations'])) {
            $dataRelations = is_string($attributes['data-relations'])
              ? json_decode($attributes['data-relations'], true)
              : $attributes['data-relations'];

            if (is_array($dataRelations)) {
                $relations = array_merge($relations, $dataRelations);
            }
        }

        // Check for other attributes that might contain Handlebar tokens
        foreach ($attributes as $key => $value) {
            if (is_string($value) && Str::contains($value, ['{{', '}}'])) {
                $attrRelations = $this->parseHandlebarTokens($value);
                $relations     = array_merge($relations, $attrRelations);
            }
        }

        return $relations;
    }

    /**
     * Parse Handlebar tokens to find relation paths
     *
     * Identifies patterns:
     * - {{relation doc.relationName}}
     * - {{#each relationName}}
     * - {{doc.relation.property}} (dot notation)
     *
     * @param  string  $content  Content with Handlebar tokens
     * @return array Array of relation paths
     */
    protected function parseHandlebarTokens(string $content): array {
        $relations = [];

        // Pattern 1: {{relation doc.relationName}} or {{relation relationName}} or {{relation this.relationName}}
        // Matches: {{relation doc.customer}}, {{relation items.product}}, {{relation this.unit}}
        preg_match_all('/\{\{\s*relation\s+(?:doc\.|this\.)?([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\}\}/', $content, $matches);
        if (! empty($matches[1])) {
            foreach ($matches[1] as $match) {
                $relations[] = $match;
                // Also add parent relations for nested paths
                $relations = array_merge($relations, $this->extractParentRelations($match));
            }
        }

        // Pattern 2: {{#each relationName}} - iteration blocks
        // Matches: {{#each items}}, {{#each customer.orders}}
        preg_match_all('/\{\{\s*#each\s+(?:doc\.)?([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\}\}/', $content, $matches);
        if (! empty($matches[1])) {
            foreach ($matches[1] as $match) {
                $relations[] = $match;
                // Also add parent relations for nested paths
                $relations = array_merge($relations, $this->extractParentRelations($match));
            }
        }

        // Pattern 3: {{doc.relation.property}} - dot notation access
        // Matches: {{doc.customer.name}}, {{doc.amended_from.customer}}
        preg_match_all('/\{\{\s*doc\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)\s*\}\}/', $content, $matches);
        if (! empty($matches[1])) {
            foreach ($matches[1] as $match) {
                // Extract all relation segments
                $parts = explode('.', $match);

                // Add each level of the relation path up to 3 levels
                $path = '';
                for ($i = 0; $i < min(count($parts), 3); $i++) {
                    $path .= ($path ? '.' : '') . $parts[$i];
                    $relations[] = $path;
                }
            }
        }

        // Pattern 4: {{this.relation.property}} - within iteration blocks
        // Matches: {{this.product.name}}, {{this.customer.address}}
        preg_match_all('/\{\{\s*this\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\}\}/', $content, $matches);
        if (! empty($matches[1])) {
            foreach ($matches[1] as $match) {
                $parts = explode('.', $match);

                // Add each level of the relation path up to 3 levels
                $path = '';
                for ($i = 0; $i < min(count($parts), 3); $i++) {
                    $path .= ($path ? '.' : '') . $parts[$i];
                    $relations[] = $path;
                }
            }
        }

        return $relations;
    }

    /**
     * Extract parent relations from a nested relation path
     *
     * For "customer.address.city", returns ["customer", "customer.address"]
     *
     * @param  string  $relationPath  Nested relation path
     * @return array Array of parent relation paths
     */
    protected function extractParentRelations(string $relationPath): array {
        $parents = [];
        $parts   = explode('.', $relationPath);

        // Build parent paths
        $path = '';
        for ($i = 0; $i < count($parts) - 1; $i++) {
            $path .= ($path ? '.' : '') . $parts[$i];
            $parents[] = $path;
        }

        return $parents;
    }

    /**
     * Normalize relation paths
     *
     * Removes duplicates, sorts alphabetically, and filters out invalid paths.
     *
     * @param  array  $relations  Array of relation paths
     * @return array Normalized array of unique relation paths
     */
    public function normalizeRelations(array $relations): array {
        // Remove empty values
        $relations = array_filter($relations, function ($relation) {
            return ! empty($relation) && is_string($relation);
        });

        // Remove duplicates
        $relations = array_unique($relations);

        // Filter out relations that are too deep (more than 3 levels)
        $relations = array_filter($relations, function ($relation) {
            return $this->getRelationDepth($relation) <= 3;
        });

        // Sort alphabetically for consistency
        sort($relations);

        // Re-index array
        return array_values($relations);
    }

    /**
     * Validate relation paths against model
     *
     * Checks if the specified relations exist on the given model class.
     * Returns only valid relations.
     *
     * @param  string  $modelClass  Fully qualified model class name
     * @param  array  $relations  Array of relation paths to validate
     * @return array Array of valid relation paths
     */
    public function validateRelations(string $modelClass, array $relations): array {
        if (! class_exists($modelClass)) {
            return [];
        }

        $validRelations = [];

        try {
            $modelInstance = new $modelClass;

            foreach ($relations as $relationPath) {
                if ($this->isValidRelationPath($modelInstance, $relationPath)) {
                    $validRelations[] = $relationPath;
                }
            }
        } catch (\Exception $e) {
            // If model instantiation fails, return empty array
            return [];
        }

        return $validRelations;
    }

    /**
     * Check if a relation path is valid on a model instance
     *
     * @param  mixed  $model  Model instance
     * @param  string  $relationPath  Relation path (e.g., "customer.address")
     * @return bool True if relation path is valid
     */
    protected function isValidRelationPath($model, string $relationPath): bool {
        $parts        = explode('.', $relationPath);
        $currentModel = $model;

        foreach ($parts as $relation) {
            // Check if method exists on current model
            if (! method_exists($currentModel, $relation)) {
                return false;
            }

            // Try to get the relation
            try {
                $relationInstance = $currentModel->$relation();

                // Check if it's actually a relation
                if (! $relationInstance instanceof Relation) {
                    return false;
                }

                // Get the related model for next iteration
                $currentModel = $relationInstance->getRelated();
            } catch (\Exception $e) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get the depth of a relation path
     *
     * Returns the number of levels in the relation path.
     * Examples:
     * - "customer" -> 1
     * - "customer.address" -> 2
     * - "order.customer.address" -> 3
     *
     * @param  string  $relationPath  Relation path
     * @return int Depth of the relation path
     */
    protected function getRelationDepth(string $relationPath): int {
        return count(explode('.', $relationPath));
    }
}

<?php

namespace App\Services\Handlebar;

/**
 * LabelHelperService
 *
 * Unified service for retrieving field labels from DataTableColumns configuration.
 * Replaces separate infoColumns and trans helpers with a single label helper.
 *
 * Requirements: 2.9, 2.10
 */
class LabelHelperService {
    /**
     * Get label for a single field path
     *
     * @param  string  $fieldPath  Field path (e.g., 'customer.name', 'items.product')
     * @param  array  $dataTableColumns  DataTableColumns configuration array
     * @param  string  $locale  Language locale (default: 'en')
     * @return string Label for the field or the field path if not found
     */
    public function getLabel(string $fieldPath, array $dataTableColumns, string $locale = 'en'): string {
        $resolved = $this->resolveFieldPath($fieldPath, $dataTableColumns);

        if ($resolved === null) {
            return $fieldPath;
        }

        // Check for titleTrans first (translation key)
        if (isset($resolved['titleTrans'])) {
            // Try to translate, but fall back gracefully if translator is not available
            try {
                if (function_exists('trans')) {
                    $translated = trans($resolved['titleTrans'], [], $locale);
                    // If translation exists and is not the key itself, return it
                    if ($translated !== $resolved['titleTrans']) {
                        return $translated;
                    }
                }
            } catch (\Exception $e) {
                // Translation failed, continue to fallback
            }
        }

        // Fall back to title if available
        if (isset($resolved['title'])) {
            return $resolved['title'];
        }

        // Fall back to name with formatting
        if (isset($resolved['name'])) {
            return ucwords(str_replace(['_', '-'], ' ', $resolved['name']));
        }

        return $fieldPath;
    }

    /**
     * Get labels for multiple field paths
     *
     * @param  array  $fieldPaths  Array of field paths
     * @param  array  $dataTableColumns  DataTableColumns configuration array
     * @param  string  $locale  Language locale (default: 'en')
     * @return array Associative array of field path => label
     */
    public function getLabels(array $fieldPaths, array $dataTableColumns, string $locale = 'en'): array {
        $labels = [];

        foreach ($fieldPaths as $fieldPath) {
            $labels[$fieldPath] = $this->getLabel($fieldPath, $dataTableColumns, $locale);
        }

        return $labels;
    }

    /**
     * Resolve nested field path to column definition
     *
     * Supports paths like:
     * - 'name' (simple field)
     * - 'customer.name' (nested relation field)
     * - 'items.product.category' (deeply nested)
     *
     * @param  string  $path  Field path with dot notation
     * @param  array  $columns  DataTableColumns configuration array
     * @return array|null Column definition or null if not found
     */
    protected function resolveFieldPath(string $path, array $columns): ?array {
        $parts   = explode('.', $path);
        $current = $columns;

        foreach ($parts as $index => $part) {
            $found = false;

            // Search in current level columns
            foreach ($current as $column) {
                // Match by name or nameOfFunction (for relations)
                if (
                    (isset($column['name']) && $column['name'] === $part) ||
                    (isset($column['nameOfFunction']) && $column['nameOfFunction'] === $part)
                ) {
                    // If this is the last part, return the column
                    if ($index === count($parts) - 1) {
                        return $column;
                    }

                    // If there are more parts, navigate into nested columns
                    if (isset($column['columns']) && is_array($column['columns'])) {
                        $current = $column['columns'];
                        $found   = true;
                        break;
                    }

                    // No nested columns available but path continues
                    return null;
                }
            }

            // If we didn't find the part at this level, path is invalid
            if (! $found) {
                return null;
            }
        }

        return null;
    }
}

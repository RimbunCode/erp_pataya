<?php

namespace App\Services\Core\PrintTemplate;

use App\Utils;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Str;
use ReflectionMethod;
use Throwable;

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
        foreach ($attributes as $value) {
            if (is_string($value) && Str::contains($value, ['{{', '}}'])) {
                $attrRelations = $this->parseHandlebarTokens($value);
                $relations     = array_merge($relations, $attrRelations);
            }
        }

        return $relations;
    }

    /** @var string[] Valid prefixes for accessing document data */
    protected const DATA_PREFIXES = ['doc', 'docInfo', 'company'];

    /**
     * Parse Handlebar tokens to find relation paths
     *
     * Context-aware parsing that tracks #each block scopes to correctly
     * resolve `this.*` references relative to their parent iteration context.
     *
     * Valid data prefixes: doc, docInfo, company
     *
     * Rules:
     * - {{relation prefix.path}} → ALL segments after prefix are relations (build incremental paths)
     * - {{prefix.X}} → no relation (single segment = direct property)
     * - {{prefix.X.Y.Z}} → all segments except last are relations (last = property), build incremental
     * - {{#each prefix.path}} → path is relation context for this.* inside
     * - {{relation this.path}} inside #each → ALL segments are relations, prefixed with context
     * - {{this.X}} inside #each → no relation (single segment = property of iterated item)
     * - {{this.X.Y.Z}} inside #each → all except last are relations, prefixed with context
     *
     * @param  string  $content  Content with Handlebar tokens
     * @return array Array of relation paths
     */
    protected function parseHandlebarTokens(string $content): array {
        $relations = [];

        // Build regex prefix pattern: (?:doc|docInfo|company)
        $prefixPattern = '(?:' . implode('|', self::DATA_PREFIXES) . ')';

        // Step 1: Find all #each blocks and process them with context
        $relations = array_merge($relations, $this->parseEachBlocks($content, '', $prefixPattern));

        // Step 2: Process top-level content (outside #each blocks)
        $topLevelContent = $this->stripEachBlocks($content);

        // Pattern: {{relation prefix.X}} or {{relation prefix.X.Y.Z}}
        // ALL segments after prefix are relation paths → build incremental
        $pattern = '/\{\{\s*relation\s+' . $prefixPattern . '\.([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\}\}/';
        preg_match_all($pattern, $topLevelContent, $matches);
        if (! empty($matches[1])) {
            foreach ($matches[1] as $match) {
                $relations = array_merge($relations, $this->buildIncrementalPaths($match));
            }
        }

        // Pattern: {{prefix.X.Y...}} (2+ segments after prefix, NO relation keyword)
        // All segments except the LAST are relations → build incremental paths excluding last
        $pattern = '/\{\{\s*' . $prefixPattern . '\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)\s*\}\}/';
        preg_match_all($pattern, $topLevelContent, $matches);
        if (! empty($matches[1])) {
            foreach ($matches[1] as $match) {
                $relations = array_merge($relations, $this->buildIncrementalPaths($match, true));
            }
        }

        // Note: {{prefix.X}} (single segment) is a direct property access, NOT a relation

        return $relations;
    }

    /**
     * Build incremental relation paths from a dot-separated path
     *
     * Examples:
     * - "category" (excludeLast=false) → ["category"]
     * - "purchase_request.created_by.role" (excludeLast=false) → ["purchase_request", "purchase_request.created_by", "purchase_request.created_by.role"]
     * - "purchase_request.created_by.name" (excludeLast=true) → ["purchase_request", "purchase_request.created_by"]
     * - "category.name" (excludeLast=true) → ["category"]
     * - "note" (excludeLast=true) → [] (single segment with excludeLast = no relation)
     *
     * @param  string  $path  Dot-separated path
     * @param  bool  $excludeLast  If true, last segment is treated as property (not relation)
     * @param  string  $prefix  Optional prefix to prepend to all paths
     * @return array Array of incremental relation paths
     */
    protected function buildIncrementalPaths(string $path, bool $excludeLast = false, string $prefix = ''): array {
        $parts  = explode('.', $path);
        $count  = $excludeLast ? count($parts) - 1 : count($parts);
        $result = [];

        $currentPath = '';
        for ($i = 0; $i < $count; $i++) {
            $currentPath .= ($currentPath ? '.' : '') . $parts[$i];
            $fullPath = $prefix ? $prefix . '.' . $currentPath : $currentPath;
            $result[] = $fullPath;
        }

        return $result;
    }

    /**
     * Parse #each blocks recursively to resolve this.* references with context
     *
     * @param  string  $content  Content to parse
     * @param  string  $contextPath  Current context path from parent #each
     * @param  string  $prefixPattern  Regex pattern for valid prefixes
     * @return array Array of relation paths
     */
    protected function parseEachBlocks(string $content, string $contextPath, string $prefixPattern): array {
        $relations = [];

        // Find matching #each / /each pairs iteratively
        $blocks = $this->findEachBlocks($content, $prefixPattern);

        foreach ($blocks as $block) {
            $eachPath     = $block['path'];
            $blockContent = $block['content'];

            // The #each path itself is a relation (build incremental from context)
            $fullEachPath = $contextPath ? $contextPath . '.' . $eachPath : $eachPath;
            $relations    = array_merge($relations, $this->buildIncrementalPaths($fullEachPath));

            // Process content inside this #each block (excluding nested #each)
            $innerContent = $this->stripEachBlocks($blockContent);

            // {{relation this.X}} or {{relation this.X.Y}} inside this block
            // ALL segments after this. are relations → build incremental prefixed with fullEachPath
            preg_match_all('/\{\{\s*relation\s+this\.([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\}\}/', $innerContent, $matches);
            if (! empty($matches[1])) {
                foreach ($matches[1] as $match) {
                    $relations = array_merge($relations, $this->buildIncrementalPaths($match, false, $fullEachPath));
                }
            }

            // {{this.X.Y...}} (1+ segments, NO relation keyword) inside this block
            // All segments except LAST are relations → build incremental prefixed with fullEachPath
            preg_match_all('/\{\{\s*this\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\}\}/', $innerContent, $matches);
            if (! empty($matches[1])) {
                foreach ($matches[1] as $match) {
                    $relations = array_merge($relations, $this->buildIncrementalPaths($match, true, $fullEachPath));
                }
            }

            // Note: {{this.X}} (single segment) is a property of the iterated item, NOT a relation

            // Recursively process nested #each blocks inside this block
            $nestedRelations = $this->parseEachBlocks($blockContent, $fullEachPath, $prefixPattern);
            $relations       = array_merge($relations, $nestedRelations);
        }

        return $relations;
    }

    /**
     * Find all outermost #each blocks in content
     *
     * Handles nested #each blocks by tracking depth.
     *
     * @param  string  $content  Content to search
     * @param  string  $prefixPattern  Regex pattern for valid prefixes
     * @return array<array{path: string, content: string}> Array of blocks with path and inner content
     */
    protected function findEachBlocks(string $content, string $prefixPattern): array {
        $blocks = [];
        $offset = 0;

        while (preg_match('/\{\{\s*#each\s+(?:(?:' . $prefixPattern . '|this)\.)' . '([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\}\}/s', $content, $match, PREG_OFFSET_CAPTURE, $offset)) {
            $startPos    = $match[0][1];
            $startTagEnd = $startPos + strlen($match[0][0]);
            $eachPath    = $match[1][0];

            // Find matching {{/each}} by tracking depth
            $depth      = 1;
            $searchPos  = $startTagEnd;
            $contentLen = strlen($content);

            while ($depth > 0 && $searchPos < $contentLen) {
                $nextOpen  = preg_match('/\{\{\s*#each\s/', $content, $openMatch, PREG_OFFSET_CAPTURE, $searchPos) ? $openMatch[0][1] : PHP_INT_MAX;
                $nextClose = preg_match('/\{\{\s*\/each\s*\}\}/', $content, $closeMatch, PREG_OFFSET_CAPTURE, $searchPos) ? $closeMatch[0][1] : PHP_INT_MAX;

                if ($nextClose === PHP_INT_MAX) {
                    // No closing tag found, break
                    break;
                }

                if ($nextOpen < $nextClose) {
                    $depth++;
                    $searchPos = $nextOpen + 1;
                } else {
                    $depth--;
                    if ($depth === 0) {
                        $innerContent = substr($content, $startTagEnd, $nextClose - $startTagEnd);
                        $blocks[]     = [
                            'path'    => $eachPath,
                            'content' => $innerContent,
                        ];
                        $offset = $nextClose + strlen($closeMatch[0][0]);
                    } else {
                        $searchPos = $nextClose + 1;
                    }
                }
            }

            // If we couldn't find a matching close, move past this open tag
            if ($depth > 0) {
                $offset = $startTagEnd;
            }
        }

        return $blocks;
    }

    /**
     * Strip #each blocks from content to get only top-level tokens
     *
     * Removes all {{#each ...}}...{{/each}} blocks from content.
     *
     * @param  string  $content  Content with #each blocks
     * @return string Content with #each blocks removed
     */
    protected function stripEachBlocks(string $content): string {
        $result = '';
        $offset = 0;
        $len    = strlen($content);

        while ($offset < $len) {
            // Find next #each opening
            if (preg_match('/\{\{\s*#each\s/', $content, $match, PREG_OFFSET_CAPTURE, $offset)) {
                $startPos = $match[0][1];

                // Add content before this #each block
                $result .= substr($content, $offset, $startPos - $offset);

                // Find matching {{/each}}
                $depth     = 1;
                $searchPos = $startPos + strlen($match[0][0]);

                while ($depth > 0 && $searchPos < $len) {
                    $nextOpen  = preg_match('/\{\{\s*#each\s/', $content, $openMatch, PREG_OFFSET_CAPTURE, $searchPos) ? $openMatch[0][1] : PHP_INT_MAX;
                    $nextClose = preg_match('/\{\{\s*\/each\s*\}\}/', $content, $closeMatch, PREG_OFFSET_CAPTURE, $searchPos) ? $closeMatch[0][1] : PHP_INT_MAX;

                    if ($nextClose === PHP_INT_MAX) {
                        break;
                    }

                    if ($nextOpen < $nextClose) {
                        $depth++;
                        $searchPos = $nextOpen + 1;
                    } else {
                        $depth--;
                        if ($depth === 0) {
                            $offset = $nextClose + strlen($closeMatch[0][0]);
                        } else {
                            $searchPos = $nextClose + 1;
                        }
                    }
                }

                // If no matching close found, skip past the open tag
                if ($depth > 0) {
                    $offset = $startPos + strlen($match[0][0]);
                }
            } else {
                // No more #each blocks, add remaining content
                $result .= substr($content, $offset);
                break;
            }
        }

        return $result;
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

        // Filter out relations that are too deep (more than 4 levels)
        $relations = array_filter($relations, function ($relation) {
            return $this->getRelationDepth($relation) <= 4;
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
    public function validateRelations(string $modelClass, array $relations, bool $withColumns = false): array {
        $validatedRelations       = [];
        $expandedDefaultRelations = [];
        $modelColumns             = [
            'company' => collect(Utils::getPreferenceColumns())->mapWithKeys(fn ($col) => [$col['name'] => $col]),
            'docInfo' => collect(Utils::getDocInfoColumns())->mapWithKeys(fn ($col) => [$col['name'] => $col]),
        ];
        if (! class_exists($modelClass)) {
            if (! $withColumns) {
                return $validatedRelations;
            }

            return [
                'relations'    => $validatedRelations,
                'modelColumns' => $modelColumns,
            ];
        }

        $rootModel    = new $modelClass;
        $segmentCache = [];

        if ($withColumns) {
            $this->cacheModelColumns($modelColumns, $rootModel);
        }
        foreach ($relations as $relationPath) {
            if (! \is_string($relationPath)) {
                continue;
            }

            $relationPath = trim($relationPath);
            if ($relationPath === '') {
                continue;
            }

            $resolvedRelation = $this->resolveRelationPathRecursively(
                model: $rootModel,
                segments: explode('.', $relationPath),
                segmentCache: $segmentCache,
                modelColumns: $modelColumns,
                withColumns: $withColumns,
            );

            if ($resolvedRelation === null) {
                continue;
            }

            $validatedRelations[]     = $resolvedRelation['path'];
            $expandedDefaultRelations = [
                ...$expandedDefaultRelations,
                ...$this->expandDefaultWithRelations(
                    basePath: $resolvedRelation['path'],
                    model: $resolvedRelation['model'],
                    segmentCache: $segmentCache,
                    modelColumns: $modelColumns,
                    withColumns: $withColumns,
                ),
            ];
        }

        $validatedRelations = array_values(array_unique([
            ...$validatedRelations,
            ...$expandedDefaultRelations,
        ]));

        if (! $withColumns) {
            return $validatedRelations;
        }

        return [
            'relations'    => $validatedRelations,
            'modelColumns' => $modelColumns,
        ];
    }

    /**
     * @param  string[]  $segments
     * @param  array<string, Model|false>  $segmentCache
     * @return array{path: string, model: Model}|null
     */
    private function resolveRelationPathRecursively(
        Model $model,
        array $segments,
        array &$segmentCache,
        array &$modelColumns,
        bool $withColumns,
        int $index = 0,
    ): ?array {
        if (! isset($segments[$index])) {
            return [
                'path'  => '',
                'model' => $model,
            ];
        }

        $method          = Str::camel($segments[$index]);
        $modelCacheKey   = $model::class;
        $segmentCacheKey = $modelCacheKey . '::' . $method;

        if (\array_key_exists($segmentCacheKey, $segmentCache)) {
            $cachedRelatedModel = $segmentCache[$segmentCacheKey];
            if ($cachedRelatedModel === false) {
                return null;
            }

            $relatedModel = $cachedRelatedModel;
        } else {
            if (! static::isPublicZeroArgumentMethod($model, $method)) {
                $segmentCache[$segmentCacheKey] = false;

                return null;
            }

            try {
                /**
                 * Relation::noConstraints() dipakai agar resolver hanya membaca struktur relasi,
                 * bukan menjalankan constraint relasi berdasarkan instance model tertentu.
                 */
                $relation = Relation::noConstraints($model->{$method}(...));
            } catch (Throwable) {
                $segmentCache[$segmentCacheKey] = false;

                return null;
            }

            if (! $relation instanceof Relation) {
                $segmentCache[$segmentCacheKey] = false;

                return null;
            }

            $relatedModel                   = $relation->getRelated();
            $segmentCache[$segmentCacheKey] = $relatedModel;
        }

        if ($withColumns) {
            $this->cacheModelColumns($modelColumns, $relatedModel);
        }

        $resolvedTail = $this->resolveRelationPathRecursively(
            model: $relatedModel,
            segments: $segments,
            segmentCache: $segmentCache,
            modelColumns: $modelColumns,
            withColumns: $withColumns,
            index: $index + 1,
        );

        if ($resolvedTail === null) {
            return null;
        }

        return [
            'path'  => $resolvedTail['path'] === '' ? $method : $method . '.' . $resolvedTail['path'],
            'model' => $resolvedTail['model'],
        ];
    }

    /**
     * @param  array<string, Model|false>  $segmentCache
     * @return string[]
     */
    private function expandDefaultWithRelations(
        string $basePath,
        Model $model,
        array &$segmentCache,
        array &$modelColumns,
        bool $withColumns,
    ): array {
        $expandedDefaultRelations = [];
        $defaultWiths             = array_keys($model->newQueryWithoutScopes()->getEagerLoads());

        foreach ($defaultWiths as $defaultWith) {
            if (! is_string($defaultWith)) {
                continue;
            }

            $defaultWith = trim($defaultWith);
            if ($defaultWith === '') {
                continue;
            }

            $resolvedDefaultWith = $this->resolveRelationPathRecursively(
                model: $model,
                segments: explode('.', $defaultWith),
                segmentCache: $segmentCache,
                modelColumns: $modelColumns,
                withColumns: $withColumns,
            );

            if ($resolvedDefaultWith === null || $resolvedDefaultWith['path'] === '') {
                continue;
            }

            $expandedDefaultRelations[] = $basePath . '.' . $resolvedDefaultWith['path'];
        }

        return $expandedDefaultRelations;
    }

    private function cacheModelColumns(array &$modelColumns, Model $model): void {
        $modelClass = $model::class;

        if (\array_key_exists($modelClass, $modelColumns)) {
            return;
        }

        $modelColumns[$modelClass] = collect($model::getColumns(1))
            ->mapWithKeys(fn ($column) => [$column['name'] => $column]);
    }

    private function isPublicZeroArgumentMethod(Model $model, string $method): bool {
        if (! method_exists($model, $method)) {
            return false;
        }

        $reflection = new ReflectionMethod($model, $method);

        return $reflection->isPublic()
            && $reflection->getNumberOfRequiredParameters() === 0;
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
            } catch (\Exception) {
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

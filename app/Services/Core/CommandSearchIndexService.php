<?php

namespace App\Services\Core;

use App\Models\Core\Command;
use App\Models\Core\FormatingSeries;
use App\Models\User\Permission;
use App\Utils;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

class CommandSearchIndexService {
    public function rebuild(bool $prune = true): array {
        if (! $this->isEnabled()) {
            return [
                'navigation' => 0,
                'records'    => 0,
                'total'      => 0,
            ];
        }

        $signatures = [];
        $navigation = 0;
        $records    = 0;

        $permissions = Permission::query()
            ->whereNotNull('model')
            ->orderBy('module')
            ->orderBy('name')
            ->get();

        foreach ($permissions as $permission) {
            $navigationPayload = $this->makeNavigationPayload($permission);
            if ($navigationPayload !== null) {
                $this->upsertCommand($navigationPayload);
                $signatures[] = $navigationPayload['signature'];
                $navigation++;
            }

            $recordPayloads = $this->makeRecordPayloadsForPermission($permission);
            foreach ($recordPayloads as $payload) {
                $this->upsertCommand($payload);
                $signatures[] = $payload['signature'];
                $records++;
            }
        }

        if ($prune) {
            $query = Command::query()
                ->whereNull('owner_id');
            if ($signatures !== []) {
                $query->whereNotIn('signature', $signatures);
            }
            $query->update([
                'deleted_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return [
            'navigation' => $navigation,
            'records'    => $records,
            'total'      => $navigation + $records,
        ];
    }

    public function syncFromModel(EloquentModel $model): void {
        if (! $this->isEnabled()) {
            return;
        }

        if ($model instanceof Command) {
            return;
        }

        if ($model instanceof Permission) {
            $this->syncFromPermission($model);

            return;
        }

        $modelClass = $model::class;

        if ($this->isExcludedModel($modelClass) || $this->isExcludedRecordModel($modelClass)) {
            return;
        }

        if (! method_exists($modelClass, 'templateLink')) {
            return;
        }

        if ($this->isSoftDeletedModel($model)) {
            $this->softDeleteBySource($modelClass, (string) $model->getKey());

            return;
        }

        $permission = Permission::query()->where('model', $modelClass)->first();
        if (! $permission) {
            return;
        }

        $this->loadRecordRelationsForIndex($model);

        $payload = $this->makeRecordPayload($permission, $model);
        if ($payload === null) {
            $this->softDeleteBySource($modelClass, (string) $model->getKey());

            return;
        }

        $this->upsertCommand($payload);
    }

    public function search(array $permissions, string $query = '', ?int $limit = null): array {
        if (! $this->isEnabled()) {
            return [
                'navigation' => [],
                'documents'  => [],
                'meta'       => $this->buildSearchMeta($this->defaultSearchIntent()),
            ];
        }

        $allowedModels = $this->resolveReadableModels($permissions);
        if ($allowedModels === []) {
            return [
                'navigation' => [],
                'documents'  => [],
                'meta'       => $this->buildSearchMeta($this->defaultSearchIntent()),
            ];
        }

        $limit       = $this->normalizeLimit($limit);
        $searchQuery = trim($query);
        $intent      = $this->resolveSearchIntent($allowedModels, $searchQuery);

        $builder = Command::query()
            ->whereNull('deleted_at')
            ->where(function ($nested) use ($allowedModels) {
                $nested->whereIn('target_model_type', $allowedModels)
                    ->orWhereIn('source_model_type', $allowedModels)
                    ->orWhereNull('target_model_type');
            });

        if ($searchQuery !== '') {
            $this->applySearchConstraint($builder, $searchQuery, (array) ($intent['search_tokens'] ?? []));
        }

        $candidateLimit = $searchQuery === '' ? $limit : max(120, $limit * 8);
        $rows           = $builder
            ->orderBy('title')
            ->limit($candidateLimit)
            ->get();

        $rankedRowsAll          = $this->rankSearchRows($rows, $searchQuery, $intent);
        $shouldPrioritizeRecord = ((array) ($intent['code_tokens'] ?? [])) !== [];

        if ($shouldPrioritizeRecord) {
            $documentRows = $rankedRowsAll
                ->where('type', 'record')
                ->take($limit)
                ->values();

            $navigationLimit = max(0, $limit - $documentRows->count());
            $navigationRows  = $rankedRowsAll
                ->where('type', 'navigation')
                ->take($navigationLimit)
                ->values();

            if ($navigationLimit > 0 && $searchQuery !== '' && $navigationRows->isEmpty()) {
                $navigationRows = $this->searchNavigationByFuzzy($allowedModels, $searchQuery, $navigationLimit);
            }

            if ($navigationLimit > 0) {
                $navigationRows = $this->ensureResolvedDoctypeNavigation(
                    $navigationRows,
                    $rankedRowsAll,
                    $allowedModels,
                    $intent,
                    $navigationLimit,
                );
            }
        } else {
            $rankedRows = $rankedRowsAll
                ->take($limit)
                ->values();

            $navigationRows = $rankedRows
                ->where('type', 'navigation')
                ->values();
            $documentRows = $rankedRows
                ->where('type', 'record')
                ->values();

            if ($searchQuery !== '' && $navigationRows->isEmpty()) {
                $navigationRows = $this->searchNavigationByFuzzy($allowedModels, $searchQuery, $limit);
                $documentRows   = $documentRows->take(max(0, $limit - $navigationRows->count()))->values();
            }

            $navigationRows = $this->ensureResolvedDoctypeNavigation(
                $navigationRows,
                $rankedRowsAll,
                $allowedModels,
                $intent,
                $limit,
            );
            $documentRows = $documentRows->take(max(0, $limit - $navigationRows->count()))->values();
        }

        $navigationRows = $this->ensureFormatLikeNavigationWhenDocumentsMatched(
            $navigationRows,
            $documentRows,
            $rankedRowsAll,
            $allowedModels,
            $intent,
            $searchQuery,
        );

        return [
            'navigation' => $navigationRows
                ->map(fn (Command $command) => $this->mapCommand($command))
                ->values()
                ->all(),
            'documents' => $documentRows
                ->map(fn (Command $command) => $this->mapCommand($command))
                ->values()
                ->all(),
            'meta' => $this->buildSearchMeta($intent),
        ];
    }

    private function syncFromPermission(Permission $permission): void {
        if ($this->isSoftDeletedModel($permission)) {
            Command::query()
                ->where('source_model_type', $permission->model)
                ->update([
                    'deleted_at' => now(),
                    'updated_at' => now(),
                ]);

            return;
        }

        $navigationPayload = $this->makeNavigationPayload($permission);
        if ($navigationPayload !== null) {
            $this->upsertCommand($navigationPayload);
        }

        $recordPayloads   = $this->makeRecordPayloadsForPermission($permission);
        $recordSignatures = $recordPayloads->pluck('signature')->all();

        foreach ($recordPayloads as $payload) {
            $this->upsertCommand($payload);
        }

        $cleanup = Command::query()
            ->where('type', 'record')
            ->where('source_model_type', $permission->model);
        if ($recordSignatures !== []) {
            $cleanup->whereNotIn('signature', $recordSignatures);
        }
        $cleanup->update([
            'deleted_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function makeRecordPayloadsForPermission(Permission $permission): Collection {
        $modelClass = (string) $permission->model;
        if ($modelClass === '' || ! class_exists($modelClass)) {
            return collect();
        }
        if ($this->isExcludedModel($modelClass) || $this->isExcludedRecordModel($modelClass)) {
            return collect();
        }
        if (! method_exists($modelClass, 'templateLink')) {
            return collect();
        }

        $relations = $this->resolveRecordLoadRelations($modelClass);
        $chunkSize = (int) config('command_search.record_chunk_size', 300);
        $chunkSize = $chunkSize > 0 ? $chunkSize : 300;

        $payloads = collect();
        $modelClass::query()
            ->with($relations)
            ->chunk($chunkSize, function ($rows) use ($permission, &$payloads) {
                foreach ($rows as $row) {
                    $payload = $this->makeRecordPayload($permission, $row);
                    if ($payload === null) {
                        continue;
                    }
                    $payloads->push($payload);
                }
            });

        return $payloads;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function makeNavigationPayload(Permission $permission): ?array {
        $modelClass = (string) $permission->model;

        if ($modelClass === '' || ! class_exists($modelClass)) {
            return null;
        }
        if ($this->isExcludedModel($modelClass)) {
            return null;
        }

        $baseRoute = trim((string) $permission->getRawOriginal('route'));
        $routeName = $baseRoute . '.index';
        if (! Route::has($routeName)) {
            return null;
        }

        $title    = trim((string) $permission->name);
        $subtitle = trim((string) $permission->module);

        $searchText = $this->buildSearchText(
            $title,
            $subtitle,
            $baseRoute,
            $modelClass,
        );

        return [
            'signature'         => "navigation:{$modelClass}:{$routeName}",
            'type'              => 'navigation',
            'title'             => $title,
            'subtitle'          => $subtitle !== '' ? $subtitle : null,
            'search_text'       => $searchText,
            'route_name'        => $routeName,
            'route_params'      => [],
            'target_model_type' => $modelClass,
            'target_model_id'   => null,
            'source_model_type' => $modelClass,
            'source_model_id'   => null,
            'owner_id'          => null,
            'meta'              => [
                'module' => $permission->module,
                'source' => 'permission',
            ],
            'deleted_at' => null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function makeRecordPayload(Permission $permission, EloquentModel $source): ?array {
        $sourceModelClass = $source::class;

        $target = $this->resolveTargetModel($source);
        if (! $target) {
            return null;
        }

        $targetModelClass = $target::class;
        $targetId         = (string) $target->getKey();
        if ($targetId === '') {
            return null;
        }

        $routeName = $this->resolveShowRouteName($permission, $sourceModelClass, $targetModelClass);
        if (! $routeName || ! Route::has($routeName)) {
            return null;
        }

        $routeParams = $this->resolveRouteParams($routeName, $target);
        if ($routeParams === null) {
            return null;
        }

        $title = $this->resolveTemplateTitle($source);
        if ($title === '') {
            $title = $this->resolveTemplateTitle($target);
        }
        if ($title === '') {
            $title = $targetId;
        }

        $subtitle = trim((string) $permission->name);
        $sourceId = (string) $source->getKey();

        $searchText = $this->buildSearchText(
            $title,
            $subtitle,
            (string) ($source->getAttribute('code') ?? ''),
            (string) ($target->getAttribute('code') ?? ''),
            (string) ($source->getAttribute('name') ?? ''),
            (string) ($target->getAttribute('name') ?? ''),
            (string) ($permission->module ?? ''),
            $sourceModelClass,
            $targetModelClass,
        );

        return [
            'signature'         => "record:{$sourceModelClass}:{$sourceId}:{$targetModelClass}:{$targetId}:{$routeName}",
            'type'              => 'record',
            'title'             => $title,
            'subtitle'          => $subtitle !== '' ? $subtitle : null,
            'search_text'       => $searchText,
            'route_name'        => $routeName,
            'route_params'      => $routeParams,
            'target_model_type' => $targetModelClass,
            'target_model_id'   => $targetId,
            'source_model_type' => $sourceModelClass,
            'source_model_id'   => $sourceId,
            'owner_id'          => null,
            'meta'              => [
                'module'     => $permission->module,
                'permission' => $permission->name,
            ],
            'deleted_at' => null,
        ];
    }

    private function resolveTargetModel(EloquentModel $source): ?EloquentModel {
        $mapping      = config('command_search.record_target_relations', []);
        $modelClass   = $source::class;
        $relationPath = $mapping[$modelClass] ?? null;

        if (! is_string($relationPath) || trim($relationPath) === '') {
            return $source;
        }

        $target = data_get($source, $relationPath);
        if ($target instanceof EloquentModel) {
            return $target;
        }

        if (! str_contains($relationPath, '.')) {
            $typeKey    = "{$relationPath}_type";
            $idKey      = "{$relationPath}_id";
            $targetType = $source->getAttribute($typeKey);
            $targetId   = $source->getAttribute($idKey);

            if (is_string($targetType) && $targetType !== '' && $targetId !== null && $targetId !== '') {
                if (class_exists($targetType) && is_subclass_of($targetType, EloquentModel::class)) {
                    $targetQuery = $targetType::query();
                    if (in_array(SoftDeletes::class, class_uses_recursive($targetType), true)) {
                        $targetQuery->withTrashed();
                    }

                    return $targetQuery->find($targetId);
                }
            }
        }

        return null;
    }

    private function resolveShowRouteName(Permission $permission, string $sourceModelClass, string $targetModelClass): ?string {
        $routeOverrides = (array) config('command_search.route_overrides', []);
        $override       = $routeOverrides[$targetModelClass] ?? null;
        if (is_string($override) && $override !== '') {
            return $override;
        }

        $sourceBaseRoute = trim((string) $permission->getRawOriginal('route'));
        if ($sourceBaseRoute !== '' && $targetModelClass === $sourceModelClass) {
            return "{$sourceBaseRoute}.show";
        }

        $targetBaseRoute = Str::plural((new $targetModelClass)->getNameClass());

        return "{$targetBaseRoute}.show";
    }

    /**
     * @return array<string, string>|null
     */
    private function resolveRouteParams(string $routeName, EloquentModel $target): ?array {
        $route = Route::getRoutes()->getByName($routeName);
        if (! $route) {
            return null;
        }

        $params = $route->parameterNames();
        if ($params === []) {
            return [];
        }

        $result = [];
        foreach ($params as $index => $paramName) {
            if ($index > 0) {
                return null;
            }

            $result[$paramName] = (string) $target->getRouteKey();
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function upsertCommand(array $payload): void {
        Command::withTrashed()->updateOrCreate(
            ['signature' => $payload['signature']],
            $payload,
        );
    }

    private function softDeleteBySource(string $sourceModelType, string $sourceModelId): void {
        Command::query()
            ->where('source_model_type', $sourceModelType)
            ->where('source_model_id', $sourceModelId)
            ->update([
                'deleted_at' => now(),
                'updated_at' => now(),
            ]);
    }

    /**
     * @return array<int|string, mixed>
     */
    private function resolveRecordLoadRelations(string $modelClass): array {
        $plainRelations      = [];
        $constrainedRelation = [];
        $instance            = new $modelClass;

        if (method_exists($modelClass, 'getRelationKeys')) {
            foreach ((array) $modelClass::getRelationKeys(true) as $key => $value) {
                $relationName = is_int($key) ? (is_string($value) ? $value : null) : (string) $key;
                if (! is_string($relationName) || trim($relationName) === '') {
                    continue;
                }
                if (! $this->relationPathExists($instance, $relationName)) {
                    continue;
                }

                if (is_int($key)) {
                    $plainRelations[$relationName] = $relationName;

                    continue;
                }

                $constrainedRelation[$relationName] = $value;
            }
        }

        $relationsFromTemplate = $this->extractTemplateRelations($modelClass);
        foreach ($relationsFromTemplate as $relation) {
            if ($this->relationPathExists($instance, $relation)) {
                $plainRelations[$relation] = $relation;
            }
        }

        $targetMapping = config('command_search.record_target_relations', []);
        $mappedPath    = $targetMapping[$modelClass] ?? null;
        if (is_string($mappedPath) && trim($mappedPath) !== '') {
            if ($this->relationPathExists($instance, $mappedPath)) {
                $plainRelations[$mappedPath] = $mappedPath;
            }
        }

        $resolvedRelations = array_values($plainRelations);
        foreach ($constrainedRelation as $relationName => $constraint) {
            $resolvedRelations[$relationName] = $constraint;
        }

        return $resolvedRelations;
    }

    /**
     * @return string[]
     */
    private function extractTemplateRelations(string $modelClass): array {
        if (! method_exists($modelClass, 'templateLink')) {
            return [];
        }

        $template = (string) $modelClass::templateLink();
        preg_match_all('/:((\w[\w]+{:[\w]+})|(\w[\w.]+))/', $template, $matches);

        $relations = [];
        foreach ((array) ($matches[0] ?? []) as $rawKey) {
            $clean = preg_replace('/(.*?){:(.*?)}/', ':$2', $rawKey);
            $key   = ltrim((string) $clean, ':');
            if ($key === '') {
                continue;
            }

            $relationPath = str_contains($key, '.') ? Str::beforeLast($key, '.') : $key;
            if ($relationPath !== '') {
                $relations[$relationPath] = $relationPath;
            }
        }

        return array_values($relations);
    }

    /**
     * @param  array<string, mixed>  $permissions
     * @return string[]
     */
    private function resolveReadableModels(array $permissions): array {
        $allowed = [];

        foreach ($permissions as $model => $levels) {
            if (! is_array($levels)) {
                continue;
            }

            if ($this->arrayContainsReadablePermission($levels)) {
                $allowed[$model] = $model;
            }
        }

        return array_values($allowed);
    }

    private function arrayContainsReadablePermission(array $node): bool {
        if (isset($node['permissions']) && is_array($node['permissions'])) {
            return ($node['permissions']['select'] ?? false) || ($node['permissions']['read'] ?? false);
        }

        foreach ($node as $value) {
            if (is_array($value) && $this->arrayContainsReadablePermission($value)) {
                return true;
            }
        }

        return false;
    }

    private function relationPathExists(EloquentModel $instance, string $relationPath): bool {
        $segments = explode('.', $relationPath);
        $current  = $instance;

        foreach ($segments as $segment) {
            if (! method_exists($current, $segment)) {
                return false;
            }

            $relation = $current->{$segment}();
            if (! method_exists($relation, 'getRelated')) {
                return false;
            }

            $current = $relation->getRelated();
        }

        return true;
    }

    /**
     * @param  string[]  $searchTokens
     */
    private function applySearchConstraint($builder, string $query, array $searchTokens = []): void {
        $driver    = DB::getDriverName();
        $queryLike = '%' . $query . '%';
        $terms     = collect([$query, ...$searchTokens])
            ->map(fn ($term) => trim((string) $term))
            ->filter(fn ($term) => $term !== '')
            ->unique()
            ->values();

        $builder->where(function ($nested) use ($driver, $query, $queryLike, $terms) {
            if (in_array($driver, ['mysql', 'pgsql'], true)) {
                $nested->whereFullText(['title', 'subtitle', 'search_text'], $query);
            }

            $nested->orWhere('title', 'like', $queryLike)
                ->orWhere('subtitle', 'like', $queryLike)
                ->orWhere('search_text', 'like', $queryLike);

            foreach ($terms as $term) {
                $termLike = '%' . $term . '%';
                $nested->orWhere('title', 'like', $termLike)
                    ->orWhere('subtitle', 'like', $termLike)
                    ->orWhere('search_text', 'like', $termLike);
            }
        });
    }

    /**
     * @param  string[]  $allowedModels
     * @return array<string, mixed>
     */
    private function resolveSearchIntent(array $allowedModels, string $query): array {
        $intent = $this->defaultSearchIntent();
        if ($query === '') {
            return $intent;
        }

        $tokens = $this->tokenizeSearchQuery($query);
        if ($tokens === []) {
            return $intent;
        }

        $navigationCatalog = Command::query()
            ->whereNull('deleted_at')
            ->where('type', 'navigation')
            ->where(function ($nested) use ($allowedModels) {
                $nested->whereIn('target_model_type', $allowedModels)
                    ->orWhereIn('source_model_type', $allowedModels);
            })
            ->get();

        $bestMatch        = $this->resolveBestDoctypeMatch($navigationCatalog, $tokens);
        $doctypePositions = array_values(array_unique((array) ($bestMatch['matched_positions'] ?? [])));
        $codeTokensInfo   = $this->resolveCodeTokensFromSearchTokens($tokens, $doctypePositions);
        $codeTokens       = array_values($codeTokensInfo['tokens']);
        $codePositions    = array_values($codeTokensInfo['positions']);

        $doctypeModel      = $bestMatch['doctype_model'] ?? null;
        $doctypeToken      = $bestMatch['alias'] ?? null;
        $matchedRawToken   = $this->normalizeDoctypeTokenFromPositions($tokens, $doctypePositions, 'raw');
        $matchedCanonical  = $this->normalizeDoctypeTokenFromPositions($tokens, $doctypePositions, 'canonical');
        $formatLikeDoctype = $this->resolveDoctypeFromFormatLikeTokens($allowedModels, $tokens);

        $inferredSubmitablePrefix = false;
        if ((! is_string($doctypeModel) || $doctypeModel === '') && $formatLikeDoctype !== null) {
            $inferredSubmitablePrefix = true;
            $doctypeModel             = $formatLikeDoctype['model'];
            $doctypeToken             = $formatLikeDoctype['prefix'];
            $matchedRawToken ??= $formatLikeDoctype['matched_prefix'];
            $matchedCanonical ??= $formatLikeDoctype['prefix'];
        } elseif ((! is_string($doctypeModel) || $doctypeModel === '') && $codeTokens !== []) {
            $inferredDoctype = $this->inferDoctypeFromSubmitableCodePrefix($allowedModels, $codeTokens);
            if ($inferredDoctype !== null) {
                $inferredSubmitablePrefix = true;
                $doctypeModel             = $inferredDoctype['model'];
                $doctypeToken             = $inferredDoctype['prefix'];
                $matchedRawToken ??= $inferredDoctype['prefix'];
                $matchedCanonical ??= $inferredDoctype['prefix'];
            }
        }

        $hasDoctype = is_string($doctypeModel) && $doctypeModel !== '';
        $isScoped   = $hasDoctype && $codeTokens !== [];

        $intent['is_scoped']            = $isScoped;
        $intent['doctype_model']        = $hasDoctype ? $doctypeModel : null;
        $intent['doctype_token']        = is_string($doctypeToken) && $doctypeToken !== '' ? $doctypeToken : null;
        $intent['code_tokens']          = $codeTokens;
        $intent['prioritize_documents'] = $codeTokens !== [];
        $intent['is_singular_doctype']  = $isScoped
            && $this->resolveIntentSingularDoctypeFlag($bestMatch, $doctypeModel, $navigationCatalog, $tokens);
        $intent['matched_raw_doctype_token']       = $matchedRawToken;
        $intent['matched_canonical_doctype_token'] = $matchedCanonical;
        $intent['doctype_positions']               = $doctypePositions;
        $intent['code_positions']                  = $codePositions;
        $intent['inferred_submitable_prefix']      = $inferredSubmitablePrefix;
        $intent['format_like_match']               = $formatLikeDoctype !== null;
        $fallbackSearchTokens                      = array_map(fn (array $token) => (string) $token['raw'], $tokens);
        if ($formatLikeDoctype !== null) {
            $fallbackSearchTokens[] = (string) ($formatLikeDoctype['prefix'] ?? '');
        }
        $intent['search_tokens'] = $codeTokens !== []
            ? $codeTokens
            : array_values(array_unique(array_values(array_filter($fallbackSearchTokens, fn ($token) => trim((string) $token) !== ''))));

        return $intent;
    }

    /**
     * @param  Collection<int, Command>  $navigationCatalog
     * @param  array<int, array{
     *     raw: string,
     *     normalized: string,
     *     canonical: string,
     *     position: int
     * }>  $tokens
     * @return array<string, mixed>|null
     */
    private function resolveBestDoctypeMatch(Collection $navigationCatalog, array $tokens): ?array {
        $bestMatch = null;

        foreach ($navigationCatalog as $command) {
            $aliases = $this->resolveDoctypeAliases($command);
            foreach ($aliases as $alias) {
                if ($alias === '') {
                    continue;
                }

                $aliasTokens = array_values(array_filter(explode(' ', $alias)));
                if ($aliasTokens === []) {
                    continue;
                }

                $match = $this->matchAliasTokens($tokens, $aliasTokens);
                if ($match === null) {
                    continue;
                }

                $score = count($aliasTokens) * 100;
                if (count($aliasTokens) > 1) {
                    $score += 40;
                }
                $spread = max($match) - min($match);
                if ($spread === 0) {
                    $score += 30;
                } elseif ($spread === 1) {
                    $score += 18;
                } elseif ($spread === 2) {
                    $score += 8;
                }

                $doctypeModel = $command->target_model_type ?: $command->source_model_type;
                if (! is_string($doctypeModel) || $doctypeModel === '') {
                    continue;
                }

                $candidate = [
                    'score'               => $score,
                    'model_priority'      => $this->resolveConfiguredModelPriorityForModel($doctypeModel),
                    'command'             => $command,
                    'alias'               => $alias,
                    'alias_tokens'        => $aliasTokens,
                    'matched_positions'   => $match,
                    'doctype_model'       => $doctypeModel,
                    'is_singular_doctype' => $this->resolveSingularDoctypeFromMatch($tokens, $match, $aliasTokens),
                ];

                if ($bestMatch === null || $this->isDoctypeMatchCandidateBetter($candidate, $bestMatch)) {
                    $bestMatch = $candidate;
                }
            }
        }

        return $bestMatch;
    }

    /**
     * @param  array<string, mixed>|null  $bestMatch
     * @param  Collection<int, Command>  $navigationCatalog
     * @param  array<int, array{
     *     raw: string,
     *     normalized: string,
     *     canonical: string,
     *     position: int
     * }>  $tokens
     */
    private function resolveIntentSingularDoctypeFlag(
        ?array $bestMatch,
        ?string $doctypeModel,
        Collection $navigationCatalog,
        array $tokens,
    ): bool {
        if (($bestMatch['is_singular_doctype'] ?? false) === true) {
            return true;
        }

        if (! is_string($doctypeModel) || $doctypeModel === '') {
            return false;
        }

        foreach ($navigationCatalog as $command) {
            if (! $this->commandMatchesModel($command, $doctypeModel)) {
                continue;
            }

            $aliases = $this->resolveDoctypeAliases($command);
            foreach ($aliases as $alias) {
                $aliasTokens = array_values(array_filter(explode(' ', $alias)));
                if ($aliasTokens === []) {
                    continue;
                }

                $match = $this->matchAliasTokens($tokens, $aliasTokens);
                if ($match === null) {
                    continue;
                }

                if ($this->resolveSingularDoctypeFromMatch($tokens, $match, $aliasTokens)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @param  array<int, array{
     *     raw: string,
     *     normalized: string,
     *     canonical: string,
     *     position: int
     * }>  $tokens
     * @param  int[]  $doctypePositions
     * @return array{
     *     tokens: string[],
     *     positions: int[]
     * }
     */
    private function resolveCodeTokensFromSearchTokens(array $tokens, array $doctypePositions): array {
        $codeTokens = [];
        $positions  = [];

        foreach ($tokens as $token) {
            $position = (int) ($token['position'] ?? -1);
            if ($position < 0 || in_array($position, $doctypePositions, true)) {
                continue;
            }

            $rawToken = trim($this->stripFormatPlaceholders((string) ($token['raw'] ?? '')));
            if ($rawToken === '' || ! $this->isCodeLikeToken($rawToken)) {
                continue;
            }

            $codeTokens[] = $rawToken;
            $positions[]  = $position;
        }

        return [
            'tokens'    => array_values(array_unique($codeTokens)),
            'positions' => array_values(array_unique($positions)),
        ];
    }

    /**
     * @param  string[]  $allowedModels
     * @param  string[]  $codeTokens
     * @return array{model: string, prefix: string}|null
     */
    private function inferDoctypeFromSubmitableCodePrefix(array $allowedModels, array $codeTokens): ?array {
        $prefixCatalog = $this->resolveSubmitablePrefixCatalog($allowedModels);
        if ($prefixCatalog === []) {
            return null;
        }

        foreach ($codeTokens as $codeToken) {
            foreach ($this->extractPrefixCandidatesFromCodeToken($codeToken) as $prefix) {
                $models = $prefixCatalog[$prefix] ?? [];
                if ($models === []) {
                    continue;
                }

                $model = $models[0] ?? null;
                if (! is_string($model) || $model === '') {
                    continue;
                }

                return [
                    'model'  => $model,
                    'prefix' => $prefix,
                ];
            }
        }

        return null;
    }

    /**
     * @param  string[]  $allowedModels
     * @param  array<int, array{
     *     raw: string,
     *     normalized: string,
     *     canonical: string,
     *     position: int
     * }>  $tokens
     * @return array{
     *     model: string,
     *     prefix: string,
     *     matched_prefix: string,
     *     score: float,
     *     match_type: string
     * }|null
     */
    private function resolveDoctypeFromFormatLikeTokens(array $allowedModels, array $tokens): ?array {
        $prefixCatalog = $this->resolveSubmitablePrefixCatalog($allowedModels);
        if ($prefixCatalog === []) {
            return null;
        }

        $prefixCandidates = $this->extractPrefixCandidatesFromSearchTokens($tokens);
        if ($prefixCandidates === []) {
            return null;
        }

        $bestExactCandidate = null;
        foreach ($prefixCandidates as $candidate) {
            $models = $prefixCatalog[$candidate] ?? [];
            $model  = $models[0] ?? null;
            if (! is_string($model) || $model === '') {
                continue;
            }

            $exactCandidate = [
                'model'          => $model,
                'prefix'         => $candidate,
                'matched_prefix' => $candidate,
                'score'          => 100.0,
                'match_type'     => 'exact',
                'model_priority' => $this->resolveConfiguredModelPriorityForModel($model),
            ];
            if ($bestExactCandidate === null || $this->isFormatLikeMatchCandidateBetter($exactCandidate, $bestExactCandidate)) {
                $bestExactCandidate = $exactCandidate;
            }
        }

        if ($bestExactCandidate !== null) {
            return [
                'model'          => (string) $bestExactCandidate['model'],
                'prefix'         => (string) $bestExactCandidate['prefix'],
                'matched_prefix' => (string) $bestExactCandidate['matched_prefix'],
                'score'          => (float) $bestExactCandidate['score'],
                'match_type'     => (string) $bestExactCandidate['match_type'],
            ];
        }

        $fuzzyThreshold     = 70.0;
        $bestFuzzyCandidate = null;
        foreach ($prefixCandidates as $candidate) {
            foreach ($prefixCatalog as $prefix => $models) {
                $model = $models[0] ?? null;
                if (! is_string($model) || $model === '') {
                    continue;
                }

                $similarity = $this->calculateFormatPrefixSimilarity($candidate, (string) $prefix);
                if ($similarity < $fuzzyThreshold) {
                    continue;
                }

                $fuzzyCandidate = [
                    'model'          => $model,
                    'prefix'         => (string) $prefix,
                    'matched_prefix' => $candidate,
                    'score'          => $similarity,
                    'match_type'     => 'fuzzy',
                    'model_priority' => $this->resolveConfiguredModelPriorityForModel($model),
                ];
                if ($bestFuzzyCandidate === null || $this->isFormatLikeMatchCandidateBetter($fuzzyCandidate, $bestFuzzyCandidate)) {
                    $bestFuzzyCandidate = $fuzzyCandidate;
                }
            }
        }

        if ($bestFuzzyCandidate === null) {
            return null;
        }

        return [
            'model'          => (string) $bestFuzzyCandidate['model'],
            'prefix'         => (string) $bestFuzzyCandidate['prefix'],
            'matched_prefix' => (string) $bestFuzzyCandidate['matched_prefix'],
            'score'          => (float) $bestFuzzyCandidate['score'],
            'match_type'     => (string) $bestFuzzyCandidate['match_type'],
        ];
    }

    /**
     * @param  array<int, array{
     *     raw: string,
     *     normalized: string,
     *     canonical: string,
     *     position: int
     * }>  $tokens
     * @return string[]
     */
    private function extractPrefixCandidatesFromSearchTokens(array $tokens): array {
        $prefixCandidates = [];
        foreach ($tokens as $token) {
            $rawToken = trim((string) ($token['raw'] ?? ''));
            if ($rawToken === '' || ! $this->isFormatLikeToken($rawToken)) {
                continue;
            }

            foreach ($this->extractPrefixCandidatesFromCodeToken($rawToken) as $prefix) {
                $prefixCandidates[$prefix] = $prefix;
            }
        }

        return array_values($prefixCandidates);
    }

    /**
     * @return string[]
     */
    private function extractPrefixCandidatesFromCodeToken(string $codeToken): array {
        $normalized = Str::of($this->stripFormatPlaceholders($codeToken))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9\-]/', '')
            ->value();

        if ($normalized === '') {
            return [];
        }

        $candidates = [];
        if (preg_match('/^([a-z]+)/', $normalized, $matches) === 1) {
            $candidates[] = (string) ($matches[1] ?? '');
        }

        $segments = array_values(array_filter(explode('-', $normalized)));
        if ($segments !== [] && preg_match('/^([a-z]+)/', (string) $segments[0], $segmentMatch) === 1) {
            $candidates[] = (string) ($segmentMatch[1] ?? '');
        }

        return array_values(array_unique(array_filter($candidates)));
    }

    /**
     * @param  string[]  $allowedModels
     * @return array<string, string[]>
     */
    private function resolveSubmitablePrefixCatalog(array $allowedModels): array {
        if ($allowedModels === []) {
            return [];
        }

        $submitableModels = Permission::query()
            ->where('is_submitable', true)
            ->whereIn('model', $allowedModels)
            ->pluck('model')
            ->filter(fn ($model) => is_string($model) && $model !== '')
            ->values()
            ->all();

        if ($submitableModels === []) {
            return [];
        }

        $catalog = [];
        $rows    = FormatingSeries::query()
            ->whereIn('model', $submitableModels)
            ->get(['model', 'format']);

        foreach ($rows as $row) {
            if (! is_string($row->model) || $row->model === '') {
                continue;
            }

            foreach ($this->extractSubmitablePrefixesFromFormat((string) $row->format) as $prefix) {
                if (! isset($catalog[$prefix])) {
                    $catalog[$prefix] = [];
                }
                $catalog[$prefix][$row->model] = $row->model;
            }
        }

        foreach ($catalog as $prefix => $models) {
            $sortedModels = array_values($models);
            usort($sortedModels, function (string $left, string $right) {
                $leftPriority  = $this->resolveConfiguredModelPriorityForModel($left);
                $rightPriority = $this->resolveConfiguredModelPriorityForModel($right);
                if ($leftPriority !== $rightPriority) {
                    return $rightPriority <=> $leftPriority;
                }

                return strcmp($left, $right);
            });
            $catalog[$prefix] = $sortedModels;
        }

        return $catalog;
    }

    /**
     * @return string[]
     */
    private function extractSubmitablePrefixesFromFormat(string $format): array {
        $literal = Str::of($this->stripFormatPlaceholders($format))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->value();

        if ($literal === '') {
            return [];
        }

        return collect(explode(' ', $literal))
            ->map(fn ($token) => trim((string) $token))
            ->filter(fn ($token) => $token !== '' && preg_match('/[a-z]/', $token) === 1)
            ->map(fn ($token) => Str::singular($token))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{
     *     raw: string,
     *     normalized: string,
     *     canonical: string,
     *     position: int
     * }>  $tokens
     * @param  string[]  $aliasTokens
     * @return int[]|null
     */
    private function matchAliasTokens(array $tokens, array $aliasTokens): ?array {
        $matchedPositions        = [];
        $usedPositions           = [];
        $typoSimilarityThreshold = 50.0;

        foreach ($aliasTokens as $aliasToken) {
            $foundPosition = null;
            foreach ($tokens as $token) {
                $position = (int) ($token['position'] ?? -1);
                if ($position < 0 || isset($usedPositions[$position])) {
                    continue;
                }

                $tokenCanonical = (string) ($token['canonical'] ?? '');
                $aliasCanonical = (string) $aliasToken;
                if ($tokenCanonical !== $aliasCanonical) {
                    $normalizedToken = $this->normalizeTokenForSingularityCheck((string) ($token['raw'] ?? ''));
                    $normalizedAlias = $this->normalizeTokenForSingularityCheck($aliasCanonical);
                    if ($normalizedToken === '' || $normalizedAlias === '') {
                        continue;
                    }

                    $tokenSingular = (string) Str::singular($normalizedToken);
                    $aliasSingular = (string) Str::singular($normalizedAlias);
                    $similarity    = $this->calculateStringSimilarity($tokenSingular, $aliasSingular);
                    if ($similarity < $typoSimilarityThreshold) {
                        continue;
                    }
                }

                $foundPosition = $position;
                break;
            }

            if ($foundPosition === null) {
                return null;
            }

            $usedPositions[$foundPosition] = true;
            $matchedPositions[]            = $foundPosition;
        }

        sort($matchedPositions);

        return $matchedPositions;
    }

    /**
     * @param  array<int, array{
     *     raw: string,
     *     normalized: string,
     *     canonical: string,
     *     position: int
     * }>  $tokens
     * @param  int[]  $positions
     */
    private function normalizeDoctypeTokenFromPositions(array $tokens, array $positions, string $key): ?string {
        if ($positions === []) {
            return null;
        }

        $values = [];
        foreach ($positions as $position) {
            $matchedToken = collect($tokens)->first(function (array $token) use ($position) {
                return (int) ($token['position'] ?? -1) === (int) $position;
            });
            if (! is_array($matchedToken) || ! isset($matchedToken[$key])) {
                continue;
            }
            $value = trim((string) $matchedToken[$key]);
            if ($value !== '') {
                $values[] = $value;
            }
        }

        if ($values === []) {
            return null;
        }

        return implode(' ', $values);
    }

    private function isCodeLikeToken(string $token): bool {
        $normalized = Str::of($this->stripFormatPlaceholders($token))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9\-]/', '')
            ->value();

        if ($normalized === '') {
            return false;
        }

        $hasDigit = preg_match('/\d/', $normalized) === 1;
        $hasAlpha = preg_match('/[a-z]/', $normalized) === 1;
        if ($hasDigit && $hasAlpha) {
            return true;
        }

        return $hasDigit && strlen($normalized) >= 3;
    }

    private function isFormatLikeToken(string $token): bool {
        $sanitized = Str::of($this->stripFormatPlaceholders($token))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9\-]/', '')
            ->value();

        if ($sanitized === '') {
            return false;
        }

        $hasAlpha = preg_match('/[a-z]/', $sanitized) === 1;
        if (! $hasAlpha) {
            return false;
        }

        $hasDigit     = preg_match('/\d/', $sanitized) === 1;
        $hasDash      = str_contains($sanitized, '-');
        $lettersOnly  = preg_replace('/[^a-z]/', '', $sanitized);
        $letterLength = is_string($lettersOnly) ? strlen($lettersOnly) : 0;

        return $hasDigit || $hasDash || $letterLength <= 3;
    }

    /**
     * @param  Collection<int, Command>  $rows
     * @param  array<string, mixed>  $intent
     * @return Collection<int, Command>
     */
    private function rankSearchRows(Collection $rows, string $searchQuery, array $intent): Collection {
        if ($searchQuery === '') {
            return $rows
                ->sort(function (Command $left, Command $right) {
                    $leftTypeOrder  = $left->type === 'navigation' ? 0 : 1;
                    $rightTypeOrder = $right->type === 'navigation' ? 0 : 1;

                    if ($leftTypeOrder !== $rightTypeOrder) {
                        return $leftTypeOrder <=> $rightTypeOrder;
                    }

                    return strcmp((string) $left->title, (string) $right->title);
                })
                ->values();
        }

        $scoredRows = $rows->map(function (Command $command, int $index) use ($searchQuery, $intent) {
            return [
                'command' => $command,
                'score'   => $this->resolveCommandSearchScore($command, $searchQuery, $intent),
                'index'   => $index,
            ];
        });

        return $scoredRows
            ->sort(function (array $left, array $right) {
                if ($left['score'] !== $right['score']) {
                    return $right['score'] <=> $left['score'];
                }

                $leftTitle  = (string) $left['command']->title;
                $rightTitle = (string) $right['command']->title;
                if ($leftTitle !== $rightTitle) {
                    return strcmp($leftTitle, $rightTitle);
                }

                return $left['index'] <=> $right['index'];
            })
            ->map(fn (array $item) => $item['command'])
            ->values();
    }

    /**
     * @param  array<string, mixed>  $intent
     */
    private function resolveCommandSearchScore(Command $command, string $searchQuery, array $intent): float {
        $score = $this->resolveBaseSearchScore($command, $searchQuery);

        $doctypeModel = $intent['doctype_model'] ?? null;
        if (is_string($doctypeModel) && $doctypeModel !== '') {
            if ($this->commandMatchesModel($command, $doctypeModel)) {
                $score += 36.0;
            }
        }

        $codeTokens = (array) ($intent['code_tokens'] ?? []);
        if ($codeTokens !== []) {
            $score += $this->resolveCodeBoostScore($command, $codeTokens);
        }

        if (($intent['prioritize_documents'] ?? false) === true) {
            $score += $command->type === 'record' ? 24.0 : 6.0;
        }

        if (($intent['is_scoped'] ?? false) === true && $codeTokens !== []) {
            $score += $command->type === 'record' ? 12.0 : 2.0;
        }

        if (($intent['is_singular_doctype'] ?? false) === true && $command->type === 'record') {
            if (is_string($doctypeModel) && $doctypeModel !== '' && $this->commandMatchesModel($command, $doctypeModel)) {
                $score += 14.0;
            }
        }

        $score += $this->resolveProximityBoostScore($intent);

        if (($intent['inferred_submitable_prefix'] ?? false) === true) {
            if (is_string($doctypeModel) && $doctypeModel !== '' && $this->commandMatchesModel($command, $doctypeModel)) {
                $score += 10.0;
            }
        }

        $score += $this->resolveConfiguredModelPriorityBoost($command);

        return $score;
    }

    /**
     * @param  array<string, mixed>  $intent
     */
    private function resolveProximityBoostScore(array $intent): float {
        $doctypePositions = array_values((array) ($intent['doctype_positions'] ?? []));
        $codePositions    = array_values((array) ($intent['code_positions'] ?? []));
        if ($doctypePositions === [] || $codePositions === []) {
            return 0.0;
        }

        $distance = null;
        foreach ($doctypePositions as $doctypePosition) {
            foreach ($codePositions as $codePosition) {
                $delta    = abs((int) $doctypePosition - (int) $codePosition);
                $distance = $distance === null ? $delta : min($distance, $delta);
            }
        }

        if ($distance === null) {
            return 0.0;
        }
        if ($distance <= 1) {
            return 8.0;
        }
        if ($distance === 2) {
            return 5.0;
        }
        if ($distance === 3) {
            return 2.5;
        }

        return 0.0;
    }

    private function resolveBaseSearchScore(Command $command, string $searchQuery): float {
        $normalizedQuery = $this->normalizeSearchTextForFuzzy($searchQuery);
        if ($normalizedQuery === '') {
            return 0.0;
        }

        $candidates = collect([
            $this->normalizeSearchTextForFuzzy((string) $command->title),
            $this->normalizeSearchTextForFuzzy((string) $command->subtitle),
            $this->normalizeSearchTextForFuzzy((string) $command->search_text),
        ])
            ->filter(fn ($value) => $value !== '')
            ->unique()
            ->values();

        $bestScore = 0.0;
        foreach ($candidates as $candidate) {
            if ($candidate === $normalizedQuery) {
                return 92.0;
            }

            if (str_contains($candidate, $normalizedQuery)) {
                $bestScore = max($bestScore, 84.0);
            }

            $bestScore = max(
                $bestScore,
                $this->calculateTokenSimilarity($normalizedQuery, $candidate),
                $this->calculateStringSimilarity($normalizedQuery, $candidate),
            );
        }

        return $bestScore;
    }

    /**
     * @param  string[]  $codeTokens
     */
    private function resolveCodeBoostScore(Command $command, array $codeTokens): float {
        $searchCandidates = collect([
            $this->normalizeTextForCodeMatching((string) $command->title),
            $this->normalizeTextForCodeMatching((string) $command->search_text),
        ])
            ->filter(fn ($value) => $value !== '')
            ->values();

        $score = 0.0;
        foreach ($codeTokens as $token) {
            $normalizedToken = $this->normalizeTextForCodeMatching((string) $token);
            if ($normalizedToken === '') {
                continue;
            }

            $tokenScore = 0.0;
            foreach ($searchCandidates as $candidateText) {
                if ($candidateText === '') {
                    continue;
                }
                if (str_contains(' ' . $candidateText . ' ', ' ' . $normalizedToken . ' ')) {
                    $tokenScore = max($tokenScore, 42.0);

                    continue;
                }

                if (str_contains($candidateText, $normalizedToken)) {
                    $tokenScore = max($tokenScore, 32.0);

                    continue;
                }

                $tokenScore = max(
                    $tokenScore,
                    min(24.0, $this->calculateStringSimilarity($normalizedToken, $candidateText) * 0.30),
                );
            }

            $score += $tokenScore;
        }

        return $score;
    }

    private function commandMatchesModel(Command $command, string $modelClass): bool {
        return $command->target_model_type === $modelClass || $command->source_model_type === $modelClass;
    }

    private function resolveConfiguredModelPriorityBoost(Command $command): float {
        $targetPriority = $this->resolveConfiguredModelPriorityForModel($command->target_model_type);
        $sourcePriority = $this->resolveConfiguredModelPriorityForModel($command->source_model_type);

        return max($targetPriority, $sourcePriority);
    }

    private function resolveConfiguredModelPriorityForModel(?string $modelClass): float {
        if (! is_string($modelClass) || $modelClass === '') {
            return 0.0;
        }

        $configuredPriorities = (array) config('command_search.model_priorities', []);
        if ($configuredPriorities === []) {
            return 0.0;
        }

        return $this->resolveConfiguredModelPriorityValue($configuredPriorities[$modelClass] ?? null);
    }

    private function resolveConfiguredModelPriorityValue(mixed $value): float {
        if (! is_numeric($value)) {
            return 0.0;
        }

        return (float) $value;
    }

    /**
     * @param  array<string, mixed>  $candidate
     * @param  array<string, mixed>  $current
     */
    private function isDoctypeMatchCandidateBetter(array $candidate, array $current): bool {
        $candidatePriority = (float) ($candidate['model_priority'] ?? 0.0);
        $currentPriority   = (float) ($current['model_priority'] ?? 0.0);
        if ($candidatePriority !== $currentPriority) {
            return $candidatePriority > $currentPriority;
        }

        $candidateScore = (float) ($candidate['score'] ?? 0.0);
        $currentScore   = (float) ($current['score'] ?? 0.0);
        if ($candidateScore !== $currentScore) {
            return $candidateScore > $currentScore;
        }

        $candidateModel = (string) ($candidate['doctype_model'] ?? '');
        $currentModel   = (string) ($current['doctype_model'] ?? '');
        if ($candidateModel !== $currentModel) {
            return strcmp($candidateModel, $currentModel) < 0;
        }

        $candidateAlias = (string) ($candidate['alias'] ?? '');
        $currentAlias   = (string) ($current['alias'] ?? '');

        return strcmp($candidateAlias, $currentAlias) < 0;
    }

    /**
     * @param  array<string, mixed>  $candidate
     * @param  array<string, mixed>  $current
     */
    private function isFormatLikeMatchCandidateBetter(array $candidate, array $current): bool {
        $candidateScore = (float) ($candidate['score'] ?? 0.0);
        $currentScore   = (float) ($current['score'] ?? 0.0);
        if ($candidateScore !== $currentScore) {
            return $candidateScore > $currentScore;
        }

        $candidatePriority = (float) ($candidate['model_priority'] ?? 0.0);
        $currentPriority   = (float) ($current['model_priority'] ?? 0.0);
        if ($candidatePriority !== $currentPriority) {
            return $candidatePriority > $currentPriority;
        }

        $candidatePrefix = (string) ($candidate['prefix'] ?? '');
        $currentPrefix   = (string) ($current['prefix'] ?? '');
        if (strlen($candidatePrefix) !== strlen($currentPrefix)) {
            return strlen($candidatePrefix) > strlen($currentPrefix);
        }

        $candidateModel = (string) ($candidate['model'] ?? '');
        $currentModel   = (string) ($current['model'] ?? '');

        return strcmp($candidateModel, $currentModel) < 0;
    }

    /**
     * @param  array<int, array{
     *     raw: string,
     *     normalized: string,
     *     canonical: string,
     *     position: int
     * }>  $tokens
     * @param  int[]  $matchedPositions
     * @param  string[]  $aliasTokens
     */
    private function resolveSingularDoctypeFromMatch(array $tokens, array $matchedPositions, array $aliasTokens): bool {
        if ($matchedPositions === [] || $aliasTokens === []) {
            return false;
        }

        $matchedTokens = [];
        foreach ($matchedPositions as $position) {
            $matchedToken = collect($tokens)->first(function (array $token) use ($position) {
                return (int) ($token['position'] ?? -1) === (int) $position;
            });
            if (! is_array($matchedToken)) {
                continue;
            }
            $matchedTokens[] = $matchedToken;
        }

        if ($matchedTokens === []) {
            return false;
        }

        $pairsToCompare = min(count($matchedTokens), count($aliasTokens));
        if ($pairsToCompare <= 0) {
            return false;
        }

        $typoSimilarityThreshold = 50.0;
        for ($index = 0; $index < $pairsToCompare; $index++) {
            $rawToken = $this->normalizeTokenForSingularityCheck((string) ($matchedTokens[$index]['raw'] ?? ''));
            if ($rawToken === '') {
                return false;
            }

            $canonicalToken = $this->normalizeTokenForSingularityCheck((string) ($aliasTokens[$index] ?? ''));
            $canonicalToken = (string) Str::singular($canonicalToken);
            if ($canonicalToken === '') {
                return false;
            }

            if ($rawToken === $canonicalToken || Str::singular($rawToken) === $canonicalToken) {
                continue;
            }

            $similarity = $this->calculateStringSimilarity($rawToken, $canonicalToken);
            if ($similarity < $typoSimilarityThreshold) {
                return false;
            }
        }

        return true;
    }

    private function normalizeTokenForSingularityCheck(string $token): string {
        return Str::of($this->stripFormatPlaceholders($token))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]/', '')
            ->trim()
            ->value();
    }

    private function calculateFormatPrefixSimilarity(string $candidatePrefix, string $catalogPrefix): float {
        $candidate = $this->normalizeTokenForSingularityCheck($candidatePrefix);
        $catalog   = $this->normalizeTokenForSingularityCheck($catalogPrefix);
        if ($candidate === '' || $catalog === '') {
            return 0.0;
        }

        $candidate = (string) Str::singular($candidate);
        $catalog   = (string) Str::singular($catalog);

        if ($candidate === $catalog) {
            return 100.0;
        }

        $similarity = $this->calculateStringSimilarity($candidate, $catalog);
        $minLength  = min(strlen($candidate), strlen($catalog));
        $delta      = abs(strlen($candidate) - strlen($catalog));
        if (
            $minLength >= 2
            && $delta <= 1
            && (str_starts_with($candidate, $catalog) || str_starts_with($catalog, $candidate))
        ) {
            $similarity = max($similarity, 90.0 - ($delta * 4.0));
        }

        return $similarity;
    }

    /**
     * @param  Collection<int, Command>  $navigationRows
     * @param  Collection<int, Command>  $rankedRowsAll
     * @param  string[]  $allowedModels
     * @param  array<string, mixed>  $intent
     * @return Collection<int, Command>
     */
    private function ensureResolvedDoctypeNavigation(
        Collection $navigationRows,
        Collection $rankedRowsAll,
        array $allowedModels,
        array $intent,
        int $limit,
    ): Collection {
        if (($intent['prioritize_documents'] ?? false) !== true) {
            return $navigationRows->take($limit)->values();
        }

        $doctypeModel = $intent['doctype_model'] ?? null;
        if (! is_string($doctypeModel) || $doctypeModel === '') {
            return $navigationRows->take($limit)->values();
        }

        $alreadyHasDoctypeNavigation = $navigationRows->contains(function (Command $command) use ($doctypeModel) {
            return $this->commandMatchesModel($command, $doctypeModel);
        });
        if ($alreadyHasDoctypeNavigation) {
            return $navigationRows->take($limit)->values();
        }

        $resolved = $this->resolveDoctypeNavigationCommand($rankedRowsAll, $allowedModels, $doctypeModel);
        if (! $resolved instanceof Command) {
            return $navigationRows->take($limit)->values();
        }

        return $navigationRows
            ->prepend($resolved)
            ->unique('signature')
            ->take($limit)
            ->values();
    }

    /**
     * @param  Collection<int, Command>  $navigationRows
     * @param  Collection<int, Command>  $documentRows
     * @param  Collection<int, Command>  $rankedRowsAll
     * @param  string[]  $allowedModels
     * @param  array<string, mixed>  $intent
     * @return Collection<int, Command>
     */
    private function ensureFormatLikeNavigationWhenDocumentsMatched(
        Collection $navigationRows,
        Collection $documentRows,
        Collection $rankedRowsAll,
        array $allowedModels,
        array $intent,
        string $searchQuery,
    ): Collection {
        if (($intent['format_like_match'] ?? false) !== true) {
            return $navigationRows;
        }

        if ($documentRows->isEmpty()) {
            return $navigationRows;
        }

        $doctypeModel = $intent['doctype_model'] ?? null;
        if (! is_string($doctypeModel) || $doctypeModel === '') {
            return $navigationRows;
        }

        $alreadyHasDoctypeNavigation = $navigationRows->contains(function (Command $command) use ($doctypeModel) {
            return $this->commandMatchesModel($command, $doctypeModel);
        });
        if ($alreadyHasDoctypeNavigation) {
            return $navigationRows;
        }

        $resolved = $this->resolveDoctypeNavigationCommand($rankedRowsAll, $allowedModels, $doctypeModel);
        if (! $resolved instanceof Command) {
            return $navigationRows;
        }

        $mergedNavigation = $navigationRows
            ->push($resolved)
            ->unique('signature')
            ->values();

        return $this->rankSearchRows($mergedNavigation, $searchQuery, $intent)
            ->where('type', 'navigation')
            ->values();
    }

    /**
     * @param  Collection<int, Command>  $rankedRowsAll
     * @param  string[]  $allowedModels
     */
    private function resolveDoctypeNavigationCommand(Collection $rankedRowsAll, array $allowedModels, string $doctypeModel): ?Command {
        $resolved = $rankedRowsAll
            ->first(function (Command $command) use ($doctypeModel) {
                return $command->type === 'navigation' && $this->commandMatchesModel($command, $doctypeModel);
            });

        if ($resolved instanceof Command) {
            return $resolved;
        }

        $resolved = Command::query()
            ->whereNull('deleted_at')
            ->where('type', 'navigation')
            ->where(function ($nested) use ($allowedModels) {
                $nested->whereIn('target_model_type', $allowedModels)
                    ->orWhereIn('source_model_type', $allowedModels);
            })
            ->where(function ($nested) use ($doctypeModel) {
                $nested->where('target_model_type', $doctypeModel)
                    ->orWhere('source_model_type', $doctypeModel);
            })
            ->orderBy('title')
            ->first();

        return $resolved instanceof Command ? $resolved : null;
    }

    /**
     * @param  array<string, mixed>  $intent
     * @return array<string, mixed>
     */
    private function buildSearchMeta(array $intent): array {
        return [
            'intent' => [
                'is_scoped'                       => (bool) ($intent['is_scoped'] ?? false),
                'doctype_model'                   => is_string($intent['doctype_model'] ?? null) ? $intent['doctype_model'] : null,
                'doctype_token'                   => is_string($intent['doctype_token'] ?? null) ? $intent['doctype_token'] : null,
                'code_tokens'                     => array_values((array) ($intent['code_tokens'] ?? [])),
                'prioritize_documents'            => (bool) ($intent['prioritize_documents'] ?? false),
                'is_singular_doctype'             => (bool) ($intent['is_singular_doctype'] ?? false),
                'matched_raw_doctype_token'       => is_string($intent['matched_raw_doctype_token'] ?? null) ? $intent['matched_raw_doctype_token'] : null,
                'matched_canonical_doctype_token' => is_string($intent['matched_canonical_doctype_token'] ?? null) ? $intent['matched_canonical_doctype_token'] : null,
                'doctype_positions'               => array_values((array) ($intent['doctype_positions'] ?? [])),
                'code_positions'                  => array_values((array) ($intent['code_positions'] ?? [])),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function defaultSearchIntent(): array {
        return [
            'is_scoped'                       => false,
            'doctype_model'                   => null,
            'doctype_token'                   => null,
            'code_tokens'                     => [],
            'prioritize_documents'            => false,
            'is_singular_doctype'             => false,
            'matched_raw_doctype_token'       => null,
            'matched_canonical_doctype_token' => null,
            'doctype_positions'               => [],
            'code_positions'                  => [],
            'inferred_submitable_prefix'      => false,
            'format_like_match'               => false,
            'search_tokens'                   => [],
        ];
    }

    /**
     * @return array<int, array{
     *     raw: string,
     *     normalized: string,
     *     canonical: string,
     *     position: int
     * }>
     */
    private function tokenizeSearchQuery(string $query): array {
        $normalized = Str::of($this->stripFormatPlaceholders($query))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9\-\s]/', ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->value();
        if ($normalized === '') {
            return [];
        }

        return collect(explode(' ', $normalized))
            ->map(fn ($rawToken) => trim((string) $rawToken))
            ->filter(fn ($rawToken) => $rawToken !== '')
            ->values()
            ->map(function (string $rawToken, int $index) {
                $normalizedToken = trim((string) preg_replace('/[^a-z0-9]/', '', $rawToken));
                if ($normalizedToken === '') {
                    return null;
                }
                $canonicalToken = trim((string) Str::singular($normalizedToken));

                return [
                    'raw'        => $rawToken,
                    'normalized' => $normalizedToken,
                    'canonical'  => $canonicalToken !== '' ? $canonicalToken : $normalizedToken,
                    'position'   => $index,
                ];
            })
            ->filter(fn ($token) => is_array($token) && ($token['normalized'] ?? '') !== '')
            ->values()
            ->all();
    }

    /**
     * @return string[]
     */
    private function resolveDoctypeAliases(Command $command): array {
        $routeName = (string) ($command->route_name ?? '');
        $routeBase = Str::before($routeName, '.');
        $routeBase = preg_replace('/([a-z])([A-Z])/', '$1 $2', $routeBase);
        $routeBase = str_replace(['-', '_'], ' ', (string) $routeBase);

        $aliases = collect([
            $this->normalizeSearchTextForFuzzy((string) $command->title),
            $this->normalizeSearchTextForFuzzy((string) $command->subtitle),
            $this->normalizeSearchTextForFuzzy((string) $routeBase),
        ])
            ->filter(fn ($alias) => $alias !== '')
            ->flatMap(function (string $alias) {
                $tokens = array_values(array_filter(explode(' ', $alias)));
                if ($tokens === []) {
                    return [];
                }

                $tokenAlias = implode(' ', $tokens);
                $variants   = [$tokenAlias];
                if (count($tokens) > 1) {
                    foreach ($tokens as $token) {
                        $variants[] = $token;
                    }
                }

                return $variants;
            })
            ->map(fn ($alias) => trim((string) $alias))
            ->filter(fn ($alias) => $alias !== '')
            ->unique()
            ->values();

        return $aliases->all();
    }

    private function resolveUrl(?string $routeName, array $routeParams): ?string {
        if (! is_string($routeName) || trim($routeName) === '' || ! Route::has($routeName)) {
            return null;
        }

        try {
            return route($routeName, $routeParams, false);
        } catch (\Throwable) {
            return null;
        }
    }

    private function isSoftDeletedModel(EloquentModel $model): bool {
        if (! in_array(SoftDeletes::class, class_uses_recursive($model), true)) {
            return false;
        }

        return method_exists($model, 'trashed') && $model->trashed();
    }

    private function isExcludedModel(string $modelClass): bool {
        return in_array($modelClass, (array) config('command_search.exclude_models', []), true);
    }

    private function isExcludedRecordModel(string $modelClass): bool {
        return in_array($modelClass, (array) config('command_search.exclude_record_models', []), true);
    }

    private function loadRecordRelationsForIndex(EloquentModel $model): void {
        $relations = $this->resolveRecordLoadRelations($model::class);
        if ($relations === []) {
            return;
        }

        $model->loadMissing($relations);
    }

    private function buildSearchText(string ...$values): string {
        return collect($values)
            ->map(fn ($value) => trim((string) $value))
            ->filter(fn ($value) => $value !== '')
            ->unique()
            ->implode(' ');
    }

    /**
     * @param  string[]  $allowedModels
     * @return Collection<int, Command>
     */
    private function searchNavigationByFuzzy(array $allowedModels, string $query, int $limit): Collection {
        $normalizedQuery = $this->normalizeSearchTextForFuzzy($query);
        if ($normalizedQuery === '') {
            return collect();
        }

        $candidateLimit = max($limit * 5, 40);
        $candidates     = Command::query()
            ->whereNull('deleted_at')
            ->where('type', 'navigation')
            ->where(function ($nested) use ($allowedModels) {
                $nested->whereIn('target_model_type', $allowedModels)
                    ->orWhereIn('source_model_type', $allowedModels);
            })
            ->orderBy('title')
            ->limit($candidateLimit)
            ->get();

        return $candidates
            ->map(function (Command $command) use ($normalizedQuery) {
                return [
                    'command' => $command,
                    'score'   => $this->scoreNavigationSimilarity($normalizedQuery, $command),
                ];
            })
            ->filter(fn (array $item) => $item['score'] >= 60.0)
            ->sortByDesc(fn (array $item) => $item['score'])
            ->map(fn (array $item) => $item['command'])
            ->take($limit)
            ->values();
    }

    private function scoreNavigationSimilarity(string $normalizedQuery, Command $command): float {
        $candidates = collect([
            $this->normalizeSearchTextForFuzzy((string) $command->title),
            $this->normalizeSearchTextForFuzzy((string) $command->subtitle),
            $this->normalizeSearchTextForFuzzy((string) $command->search_text),
        ])
            ->filter(fn ($value) => $value !== '')
            ->unique()
            ->values();

        $bestScore = 0.0;
        foreach ($candidates as $candidate) {
            if ($candidate === $normalizedQuery) {
                return 100.0;
            }

            if (str_contains($candidate, $normalizedQuery)) {
                $bestScore = max($bestScore, 96.0);
            }

            $bestScore = max(
                $bestScore,
                $this->calculateStringSimilarity($normalizedQuery, $candidate),
                $this->calculateTokenSimilarity($normalizedQuery, $candidate),
            );
        }

        return $bestScore;
    }

    private function normalizeSearchTextForFuzzy(string $text): string {
        $normalized = Str::of($this->stripFormatPlaceholders($text))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9\s]/', ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->value();

        if ($normalized === '') {
            return '';
        }

        return collect(explode(' ', $normalized))
            ->filter(fn ($token) => $token !== '')
            ->map(fn ($token) => Str::singular($token))
            ->implode(' ');
    }

    private function normalizeTextForCodeMatching(string $text): string {
        return Str::of($this->stripFormatPlaceholders($text))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9\-\s]/', ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->value();
    }

    private function stripFormatPlaceholders(string $value): string {
        return Str::of($value)
            ->replaceMatches('/@\[[^\]]+\]/', ' ')
            ->value();
    }

    private function calculateTokenSimilarity(string $left, string $right): float {
        $leftTokens  = array_values(array_filter(explode(' ', $left)));
        $rightTokens = array_values(array_filter(explode(' ', $right)));

        if ($leftTokens === [] || $rightTokens === []) {
            return 0.0;
        }

        $totalScore = 0.0;
        foreach ($leftTokens as $leftToken) {
            $bestTokenScore = 0.0;
            foreach ($rightTokens as $rightToken) {
                $bestTokenScore = max($bestTokenScore, $this->calculateStringSimilarity($leftToken, $rightToken));
            }
            $totalScore += $bestTokenScore;
        }

        return $totalScore / count($leftTokens);
    }

    private function calculateStringSimilarity(string $left, string $right): float {
        if ($left === '' || $right === '') {
            return 0.0;
        }

        $maxLength = max(strlen($left), strlen($right));
        if ($maxLength === 0) {
            return 100.0;
        }

        $distance = levenshtein($left, $right);
        $distance = min($distance, $maxLength);

        return max(0.0, (1 - ($distance / $maxLength)) * 100);
    }

    /**
     * @return array<string, mixed>
     */
    private function mapCommand(Command $command): array {
        return [
            'id'                => $command->id,
            'signature'         => $command->signature,
            'type'              => $command->type,
            'title'             => $command->title,
            'subtitle'          => $command->subtitle,
            'route_name'        => $command->route_name,
            'route_params'      => $command->route_params ?? [],
            'url'               => $this->resolveUrl($command->route_name, (array) ($command->route_params ?? [])),
            'target_model_type' => $command->target_model_type,
            'target_model_id'   => $command->target_model_id,
            'source_model_type' => $command->source_model_type,
            'source_model_id'   => $command->source_model_id,
        ];
    }

    private function resolveTemplateTitle(EloquentModel $model): string {
        try {
            $title = Utils::convertTemplateLink($model->toArray());
            if (is_string($title) && trim($title) !== '') {
                return trim($title);
            }
        } catch (\Throwable) {
            // Fallback ke kolom umum jika template mengandung relation object.
        }

        foreach (['code', 'name', 'title', 'reference_to'] as $column) {
            $value = $model->getAttribute($column);
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return '';
    }

    private function isEnabled(): bool {
        return (bool) config('command_search.enabled', true);
    }

    private function normalizeLimit(?int $limit): int {
        $default = (int) config('command_search.default_limit', 30);
        $max     = (int) config('command_search.max_limit', 100);

        $default = $default > 0 ? $default : 30;
        $max     = $max > 0 ? $max : 100;

        $value = $limit ?? $default;
        if ($value <= 0) {
            $value = $default;
        }

        return min($value, $max);
    }
}

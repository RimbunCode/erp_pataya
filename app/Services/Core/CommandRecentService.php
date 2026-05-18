<?php

namespace App\Services\Core;

use App\Models\Core\Command;
use App\Models\Core\CommandRecent;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

class CommandRecentService {
    /**
     * @param  array<string, mixed>  $permissions
     * @return array<int, array<string, mixed>>
     */
    public function listForSearch(array $permissions, string $userId, int $limit = 5): array {
        if ($userId === '') {
            return [];
        }

        $limit         = max(1, min($limit, 5));
        $allowedModels = $this->resolveReadableModels($permissions);
        if ($allowedModels === []) {
            return [];
        }

        $candidates = CommandRecent::query()
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->orderByDesc('updated_at')
            ->limit(max(30, $limit * 8))
            ->get();

        return $candidates
            ->filter(fn (CommandRecent $recent) => $this->isRecentVisibleForModels($recent, $allowedModels))
            ->map(fn (CommandRecent $recent) => $this->mapRecent($recent))
            ->filter(fn (array $recent) => $recent['url'] !== null)
            ->take($limit)
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $command
     * @return array<string, mixed>|null
     */
    public function track(string $userId, array $command): ?array {
        if ($userId === '') {
            return null;
        }

        $payload = $this->resolveTrackPayload($command);
        if ($payload === null) {
            return null;
        }

        $attributes = array_merge($payload, [
            'user_id'    => $userId,
            'deleted_at' => null,
        ]);

        $recent = CommandRecent::withTrashed()
            ->where('user_id', $userId)
            ->where('recent_key', $payload['recent_key'])
            ->first();

        if ($recent instanceof CommandRecent) {
            $recent->forceFill(array_merge($attributes, [
                'updated_at' => now(),
            ]));
            $recent->save();

            $refreshed = $recent->fresh();

            return $this->mapRecent($refreshed instanceof CommandRecent ? $refreshed : $recent);
        }

        try {
            $created = CommandRecent::query()->create($attributes);

            return $this->mapRecent($created);
        } catch (QueryException $exception) {
            // Race-safe fallback when two requests track the same recent_key concurrently.
            if (! $this->isDuplicateKeyException($exception)) {
                throw $exception;
            }

            $existing = CommandRecent::withTrashed()
                ->where('user_id', $userId)
                ->where('recent_key', $payload['recent_key'])
                ->first();

            if (! $existing instanceof CommandRecent) {
                return null;
            }

            $existing->forceFill(array_merge($attributes, [
                'updated_at' => now(),
            ]));
            $existing->save();

            $refreshed = $existing->fresh();

            return $this->mapRecent($refreshed instanceof CommandRecent ? $refreshed : $existing);
        }
    }

    public function deleteOne(string $userId, string $recentKey): bool {
        if ($userId === '' || trim($recentKey) === '') {
            return false;
        }

        $recent = CommandRecent::query()
            ->where('user_id', $userId)
            ->where('recent_key', $recentKey)
            ->whereNull('deleted_at')
            ->first();
        if (! $recent instanceof CommandRecent) {
            return false;
        }

        return (bool) $recent->delete();
    }

    public function clearAll(string $userId): int {
        if ($userId === '') {
            return 0;
        }

        return CommandRecent::query()
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->update([
                'deleted_at' => now(),
                'updated_at' => now(),
            ]);
    }

    /**
     * @param  array<string, mixed>  $command
     * @return array<string, mixed>|null
     */
    private function resolveTrackPayload(array $command): ?array {
        $signature = trim((string) ($command['signature'] ?? ''));

        if ($signature !== '') {
            $indexedCommand = Command::withTrashed()
                ->where('signature', $signature)
                ->first();
            if ($indexedCommand instanceof Command) {
                $routeParams = $this->normalizeRouteParams($indexedCommand->route_params);
                if (! $this->canResolveRoute($indexedCommand->route_name, $routeParams)) {
                    return null;
                }

                return [
                    'recent_key'        => $this->resolveRecentKey($signature, $indexedCommand->route_name, $routeParams),
                    'signature'         => $indexedCommand->signature,
                    'type'              => $indexedCommand->type,
                    'title'             => (string) $indexedCommand->title,
                    'subtitle'          => $indexedCommand->subtitle,
                    'route_name'        => $indexedCommand->route_name,
                    'route_params'      => $routeParams,
                    'target_model_type' => $indexedCommand->target_model_type,
                    'target_model_id'   => $indexedCommand->target_model_id,
                    'source_model_type' => $indexedCommand->source_model_type,
                    'source_model_id'   => $indexedCommand->source_model_id,
                    'payload'           => $this->buildPayloadSnapshot(
                        $indexedCommand->signature,
                        $indexedCommand->type,
                        (string) $indexedCommand->title,
                        $indexedCommand->subtitle,
                        $indexedCommand->route_name,
                        $routeParams,
                    ),
                ];
            }
        }

        $type = trim((string) ($command['type'] ?? ''));
        if ($this->isThemeCommandType($type)) {
            return null;
        }

        $routeName = trim((string) ($command['route_name'] ?? ''));
        if ($routeName === '') {
            return null;
        }

        $routeParams = $this->normalizeRouteParams($command['route_params'] ?? []);
        if (! $this->canResolveRoute($routeName, $routeParams)) {
            return null;
        }

        $title = trim((string) ($command['title'] ?? ''));
        if ($title === '') {
            $title = $routeName;
        }

        $signature = trim((string) ($command['signature'] ?? ''));

        return [
            'recent_key'        => $this->resolveRecentKey($signature, $routeName, $routeParams),
            'signature'         => $signature !== '' ? $signature : null,
            'type'              => in_array($type, ['navigation', 'record'], true) ? $type : null,
            'title'             => $title,
            'subtitle'          => $this->normalizeNullableString($command['subtitle'] ?? null),
            'route_name'        => $routeName,
            'route_params'      => $routeParams,
            'target_model_type' => $this->normalizeNullableString($command['target_model_type'] ?? null),
            'target_model_id'   => $this->normalizeNullableString($command['target_model_id'] ?? null),
            'source_model_type' => $this->normalizeNullableString($command['source_model_type'] ?? null),
            'source_model_id'   => $this->normalizeNullableString($command['source_model_id'] ?? null),
            'payload'           => $this->buildPayloadSnapshot(
                $signature,
                in_array($type, ['navigation', 'record'], true) ? $type : null,
                $title,
                $this->normalizeNullableString($command['subtitle'] ?? null),
                $routeName,
                $routeParams,
            ),
        ];
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

    /**
     * @param  string[]  $allowedModels
     */
    private function isRecentVisibleForModels(CommandRecent $recent, array $allowedModels): bool {
        $targetModel = trim((string) ($recent->target_model_type ?? ''));
        $sourceModel = trim((string) ($recent->source_model_type ?? ''));

        if ($targetModel === '' && $sourceModel === '') {
            return true;
        }

        return in_array($targetModel, $allowedModels, true) || in_array($sourceModel, $allowedModels, true);
    }

    /**
     * @return array<string, mixed>
     */
    private function mapRecent(CommandRecent $recent): array {
        $routeParams = $this->normalizeRouteParams($recent->route_params);

        return [
            'id'                => $recent->id,
            'recent_key'        => $recent->recent_key,
            'signature'         => $recent->signature,
            'type'              => $recent->type,
            'title'             => $recent->title,
            'subtitle'          => $recent->subtitle,
            'route_name'        => $recent->route_name,
            'route_params'      => $routeParams,
            'url'               => $this->resolveUrl($recent->route_name, $routeParams),
            'target_model_type' => $recent->target_model_type,
            'target_model_id'   => $recent->target_model_id,
            'source_model_type' => $recent->source_model_type,
            'source_model_id'   => $recent->source_model_id,
            'updated_at'        => optional($recent->updated_at)?->toJSON(),
        ];
    }

    /**
     * @param  array<string, mixed>  $routeParams
     */
    private function resolveRecentKey(string $signature, ?string $routeName, array $routeParams): string {
        if (trim($signature) !== '') {
            return $signature;
        }

        $normalizedRouteName = trim((string) $routeName);
        $encodedParams       = json_encode(
            $this->sortArrayRecursive($routeParams),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        return 'route:' . $normalizedRouteName . ':' . sha1((string) ($encodedParams ?: '[]'));
    }

    /**
     * @return array<string, mixed>
     */
    private function buildPayloadSnapshot(
        ?string $signature,
        ?string $type,
        string $title,
        ?string $subtitle,
        ?string $routeName,
        array $routeParams,
    ): array {
        return [
            'signature'    => $signature,
            'type'         => $type,
            'title'        => $title,
            'subtitle'     => $subtitle,
            'route_name'   => $routeName,
            'route_params' => $routeParams,
        ];
    }

    private function isThemeCommandType(string $type): bool {
        return in_array(Str::lower(trim($type)), ['theme', 'theme-light', 'theme-dark', 'theme-system'], true);
    }

    /**
     * @param  array<string, mixed>|mixed  $routeParams
     * @return array<string, mixed>
     */
    private function normalizeRouteParams(mixed $routeParams): array {
        if (! is_array($routeParams)) {
            return [];
        }

        /** @var array<string, mixed> $sorted */
        $sorted = $this->sortArrayRecursive($routeParams);

        return $sorted;
    }

    /**
     * @param  array<string|int, mixed>  $values
     * @return array<string, mixed>
     */
    private function sortArrayRecursive(array $values): array {
        foreach ($values as $key => $value) {
            if (is_array($value)) {
                $values[$key] = $this->sortArrayRecursive($value);
            }
        }

        ksort($values);

        /** @var array<string, mixed> */
        return $values;
    }

    private function resolveUrl(?string $routeName, array $routeParams): ?string {
        if (! $this->canResolveRoute($routeName, $routeParams)) {
            return null;
        }

        try {
            return route((string) $routeName, $routeParams, false);
        } catch (\Throwable) {
            return null;
        }
    }

    private function canResolveRoute(?string $routeName, array $routeParams): bool {
        if (! is_string($routeName) || trim($routeName) === '' || ! Route::has($routeName)) {
            return false;
        }

        try {
            route($routeName, $routeParams, false);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private function normalizeNullableString(mixed $value): ?string {
        if (! is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return $normalized !== '' ? $normalized : null;
    }

    private function isDuplicateKeyException(QueryException $exception): bool {
        $sqlState = (string) ($exception->errorInfo[0] ?? '');

        return in_array($sqlState, ['23000', '23505'], true);
    }
}

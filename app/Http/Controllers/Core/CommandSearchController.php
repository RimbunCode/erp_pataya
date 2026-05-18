<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Services\Core\CommandRecentService;
use App\Services\Core\CommandSearchIndexService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommandSearchController extends Controller {
    public function __construct(
        private readonly CommandSearchIndexService $commandSearchIndexService,
        private readonly CommandRecentService $commandRecentService,
    ) {}

    public function index(Request $request): JsonResponse {
        $validated = $request->validate([
            'q'     => ['nullable', 'string', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $permissions = (array) $request->session()->get('permissions', []);
        $query       = trim((string) ($validated['q'] ?? ''));
        $limit       = isset($validated['limit']) ? (int) $validated['limit'] : null;
        $userId      = (string) ($request->user()?->getAuthIdentifier() ?? '');

        if ($query === '') {
            $recentRows = $this->commandRecentService->listForSearch(
                $permissions,
                $userId,
                5,
            );

            return response()->json([
                'data' => [
                    'navigation' => [],
                    'documents'  => [],
                    'recent'     => $recentRows,
                    'meta'       => $this->defaultMeta(),
                ],
            ]);
        }

        $results           = $this->commandSearchIndexService->search($permissions, $query, $limit);
        $results['recent'] = [];

        return response()->json([
            'data' => $results,
        ]);
    }

    public function track(Request $request): JsonResponse {
        $validated = $request->validate([
            'command'                   => ['required', 'array'],
            'command.signature'         => ['nullable', 'string', 'max:255'],
            'command.type'              => ['nullable', 'string', 'max:32'],
            'command.title'             => ['nullable', 'string', 'max:255'],
            'command.subtitle'          => ['nullable', 'string', 'max:255'],
            'command.route_name'        => ['nullable', 'string', 'max:255'],
            'command.route_params'      => ['nullable', 'array'],
            'command.target_model_type' => ['nullable', 'string', 'max:255'],
            'command.target_model_id'   => ['nullable', 'string', 'max:255'],
            'command.source_model_type' => ['nullable', 'string', 'max:255'],
            'command.source_model_id'   => ['nullable', 'string', 'max:255'],
        ]);

        $recent = $this->commandRecentService->track(
            (string) ($request->user()?->getAuthIdentifier() ?? ''),
            (array) $validated['command'],
        );

        return response()->json([
            'data' => $recent,
        ]);
    }

    public function remove(Request $request): JsonResponse {
        $validated = $request->validate([
            'recent_key' => ['nullable', 'string', 'max:255'],
        ]);

        $userId    = (string) ($request->user()?->getAuthIdentifier() ?? '');
        $recentKey = trim((string) ($validated['recent_key'] ?? ''));

        if ($recentKey !== '') {
            $deleted = $this->commandRecentService->deleteOne($userId, $recentKey);

            return response()->json([
                'data' => [
                    'deleted' => $deleted ? 1 : 0,
                    'mode'    => 'single',
                ],
            ]);
        }

        $deletedCount = $this->commandRecentService->clearAll($userId);

        return response()->json([
            'data' => [
                'deleted' => $deletedCount,
                'mode'    => 'all',
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function defaultMeta(): array {
        return [
            'intent' => [
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
            ],
        ];
    }
}

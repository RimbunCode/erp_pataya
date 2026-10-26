<?php

namespace App\Http\Controllers\Core;

use App\Enums\DefaultsDocumentType;
use App\Http\Requests\Core\DefaultsResolveRequest;
use App\Services\Core\Setting\DocumentDefaultsResolver;
use Illuminate\Http\JsonResponse;

class DefaultsResolveController {
    public function __invoke(DefaultsResolveRequest $request, DocumentDefaultsResolver $resolver): JsonResponse {
        $validated = $request->validated();
        $type      = DefaultsDocumentType::from($validated['document_type']);
        $itemIds   = array_column($validated['items'], 'item_id');

        return response()->json([
            'items' => $resolver->resolveForItems($type, $itemIds),
        ]);
    }
}

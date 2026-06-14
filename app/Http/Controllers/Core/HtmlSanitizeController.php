<?php

namespace App\Http\Controllers\Core;

use App\Http\Requests\Core\SanitizeHtmlRequest;
use App\Services\Core\PrintTemplate\HTMLSanitizerService;
use Illuminate\Http\JsonResponse;

class HtmlSanitizeController {
    public function __construct(
        protected HTMLSanitizerService $sanitizerService,
    ) {}

    /**
     * Sanitize user-provided HTML content
     *
     * Removes dangerous tags and attributes while preserving safe content.
     * Returns the sanitized HTML along with warnings about removed content.
     */
    public function __invoke(SanitizeHtmlRequest $request): JsonResponse {
        $result = $this->sanitizerService->sanitize($request->validated('html'));

        return response()->json([
            'sanitizedHTML'     => $result->sanitizedHTML,
            'warnings'          => $result->warnings,
            'removedTags'       => $result->removedTags,
            'removedAttributes' => $result->removedAttributes,
        ]);
    }
}

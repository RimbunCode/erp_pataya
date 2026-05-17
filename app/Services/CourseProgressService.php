<?php

namespace App\Services;

use Illuminate\Support\Collection;

class CourseProgressService {
    /**
     * @param  Collection<int, string>  $contentIds
     * @return array<string, bool>
     */
    public function toLookup(Collection $contentIds): array {
        $normalizedIds = $contentIds
            ->map(static fn ($contentId) => (string) $contentId)
            ->all();

        return array_fill_keys($normalizedIds, true);
    }

    /**
     * @param  array<string, bool>  $completedContentLookup
     * @param  array<string, bool>  $submittedContentLookup
     */
    public function isContentCompleted(
        string $contentType,
        string $contentId,
        array $completedContentLookup,
        array $submittedContentLookup,
    ): bool {
        return match ($contentType) {
            'material' => isset($completedContentLookup[$contentId]),
            'pre_assessment', 'assignment' => isset($submittedContentLookup[$contentId]),
            default => false,
        };
    }

    /**
     * @param  Collection<int, mixed>  $contents
     * @param  array<string, bool>  $completedContentLookup
     * @param  array<string, bool>  $submittedContentLookup
     */
    public function calculateProgress(
        Collection $contents,
        array $completedContentLookup,
        array $submittedContentLookup,
    ): int {
        $totalContents = $contents->count();

        if ($totalContents === 0) {
            return 0;
        }

        $completedContents = $contents->filter(function ($content) use ($completedContentLookup, $submittedContentLookup) {
            return $this->isContentCompleted(
                (string) $content->type,
                (string) $content->id,
                $completedContentLookup,
                $submittedContentLookup,
            );
        })->count();

        $progress = (int) round(($completedContents / $totalContents) * 100);

        return max(0, min(100, $progress));
    }

    /**
     * @param  Collection<int, mixed>  $sections
     * @param  array<string, bool>  $completedContentLookup
     * @param  array<string, bool>  $submittedContentLookup
     * @return array<int, array{title: string, done: bool, completed_contents: int, total_contents: int}>
     */
    public function buildModules(
        Collection $sections,
        array $completedContentLookup,
        array $submittedContentLookup,
    ): array {
        return $sections->map(function ($section) use ($completedContentLookup, $submittedContentLookup) {
            $contents = $section->contents;

            $totalContents     = $contents->count();
            $completedContents = $contents->filter(function ($content) use ($completedContentLookup, $submittedContentLookup) {
                return $this->isContentCompleted(
                    (string) $content->type,
                    (string) $content->id,
                    $completedContentLookup,
                    $submittedContentLookup,
                );
            })->count();

            return [
                'title'              => (string) $section->title,
                'done'               => $totalContents > 0 && $completedContents === $totalContents,
                'completed_contents' => $completedContents,
                'total_contents'     => $totalContents,
            ];
        })->values()->all();
    }

    public function resolveStatusFromProgress(int $progress): string {
        if ($progress >= 100) {
            return 'COMPLETED';
        }

        if ($progress <= 0) {
            return 'PENDING';
        }

        return 'ACTIVE';
    }
}

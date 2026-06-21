<?php

namespace App\Services\Instructor;

use App\Models\Submission;
use App\Models\UserProgress;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class StudentProgressBuilder {
    /**
     * @param  Collection<int, string>  $studentIds
     * @param  Collection<int, string>  $contentIds
     * @return array{
     *     0: array<string, array<string, bool>>,
     *     1: array<string, array<string, CarbonInterface>>
     * }
     */
    public function buildCompletedContentMaps(Collection $studentIds, Collection $contentIds): array {
        if ($studentIds->isEmpty() || $contentIds->isEmpty()) {
            return [[], []];
        }

        $progressRecords = UserProgress::query()
            ->whereIn('user_id', $studentIds)
            ->whereIn('content_id', $contentIds)
            ->where('is_completed', true)
            ->get(['user_id', 'content_id', 'completed_at']);

        $completedLookupByUser    = [];
        $completedAtByUserContent = [];

        foreach ($progressRecords as $record) {
            $userId    = (string) $record->user_id;
            $contentId = (string) $record->content_id;

            $completedLookupByUser[$userId][$contentId] = true;

            if ($record->completed_at !== null) {
                $completedAtByUserContent[$userId][$contentId] = $record->completed_at;
            }
        }

        return [$completedLookupByUser, $completedAtByUserContent];
    }

    /**
     * @param  Collection<int, string>  $studentIds
     * @param  Collection<int, string>  $contentIds
     * @return array{
     *     0: array<string, array<string, bool>>,
     *     1: array<string, array<string, CarbonInterface>>
     * }
     */
    public function buildSubmittedContentMaps(Collection $studentIds, Collection $contentIds): array {
        if ($studentIds->isEmpty() || $contentIds->isEmpty()) {
            return [[], []];
        }

        $submissions = Submission::query()
            ->whereIn('user_id', $studentIds)
            ->whereIn('content_id', $contentIds)
            ->with('files')
            ->get(['id', 'user_id', 'content_id', 'submitted_at']);

        $submittedLookupByUser    = [];
        $submittedAtByUserContent = [];

        foreach ($submissions as $submission) {
            if ($submission->files->isEmpty()) {
                continue;
            }

            $userId    = (string) $submission->user_id;
            $contentId = (string) $submission->content_id;

            $submittedLookupByUser[$userId][$contentId] = true;

            if ($submission->submitted_at !== null) {
                $submittedAtByUserContent[$userId][$contentId] = $submission->submitted_at;
            }
        }

        return [$submittedLookupByUser, $submittedAtByUserContent];
    }

    /**
     * @param  Collection<int, string>  $studentIds
     * @param  Collection<int, string>  $contentIds
     * @return array<string, array<string, array<string, mixed>>>
     */
    public function buildSubmissionsWithFiles(Collection $studentIds, Collection $contentIds): array {
        if ($studentIds->isEmpty() || $contentIds->isEmpty()) {
            return [];
        }

        $submissions = Submission::query()
            ->whereIn('user_id', $studentIds)
            ->whereIn('content_id', $contentIds)
            ->with('files')
            ->get(['id', 'user_id', 'content_id', 'notes', 'status', 'grade', 'feedback', 'submitted_at', 'graded_at']);

        $result = [];

        foreach ($submissions as $submission) {
            if ($submission->files->isEmpty()) {
                continue;
            }

            $userId    = (string) $submission->user_id;
            $contentId = (string) $submission->content_id;

            $result[$userId][$contentId] = [
                'id'           => (string) $submission->id,
                'submitted_at' => $submission->submitted_at?->format('d M Y H:i'),
                'notes'        => $submission->notes,
                'grade'        => $submission->grade,
                'feedback'     => $submission->feedback,
                'graded_at'    => $submission->graded_at?->format('d M Y H:i'),
                'files'        => $submission->files->map(fn ($file) => [
                    'id'        => (string) $file->id,
                    'fullname'  => $file->fullname,
                    'name'      => $file->name,
                    'extension' => $file->extension,
                ])->values()->all(),
            ];
        }

        return $result;
    }

    /**
     * @param  Collection<int, string>  $courseContentIds
     * @param  array<string, CarbonInterface>  $completedAtByContent
     * @param  array<string, CarbonInterface>  $submittedAtByContent
     */
    public function resolveLastActiveAt(
        CarbonInterface $enrolledAt,
        Collection $courseContentIds,
        array $completedAtByContent,
        array $submittedAtByContent,
    ): CarbonInterface {
        $latestAt = $enrolledAt;

        foreach ($courseContentIds as $contentId) {
            if (isset($completedAtByContent[$contentId]) && $completedAtByContent[$contentId]->gt($latestAt)) {
                $latestAt = $completedAtByContent[$contentId];
            }

            if (isset($submittedAtByContent[$contentId]) && $submittedAtByContent[$contentId]->gt($latestAt)) {
                $latestAt = $submittedAtByContent[$contentId];
            }
        }

        return $latestAt;
    }
}

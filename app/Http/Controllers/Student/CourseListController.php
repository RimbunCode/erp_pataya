<?php

namespace App\Http\Controllers\student;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CourseListController extends Controller {
    public function index() {
        $user = auth()->user();

        $enrollments = $user->enrollments()
            ->with(['course.categories', 'course.creator', 'course.sections.contents'])
            ->get();

        $completedContentIds = $user->progress()
            ->where('is_completed', true)
            ->pluck('content_id');

        $submittedContentIds = $user->submissions()
            ->pluck('content_id');

        $courses = $enrollments->map(fn ($enrollment) => [
            'id'             => $enrollment->course->id,
            'title'          => $enrollment->course->title,
            'instructor'     => $enrollment->course->creator?->name,
            'category'       => $enrollment->course->categories->first()?->name ?? '-',
            'thumbnail'      => $enrollment->course->thumbnail,
            'total_hours'    => $enrollment->course->total_hours,
            'total_sessions' => $enrollment->course->total_sessions,
            'enrolled_at'    => $enrollment->enrolled_at->format('d M Y'),
            'progress'       => $this->calculateProgress(
                $enrollment->course->sections,
                $completedContentIds,
                $submittedContentIds,
            ),
            'sections'       => $enrollment->course->sections->map(fn ($section) => [
                'id'       => $section->id,
                'title'    => $section->title,
                'order'    => $section->order,
                'contents' => $section->contents->map(fn ($content) => [
                    'id'           => $content->id,
                    'title'        => $content->title,
                    'type'         => $content->type,
                    'is_optional'  => $content->is_optional,
                    'deadline'     => $content->deadline?->format('d M Y'),
                    'is_completed' => match ($content->type) {
                        'material'   => $completedContentIds->contains($content->id),
                        'pre_assessment',
                        'assignment' => $submittedContentIds->contains($content->id),
                        default      => false,
                    },
                ])->values()->toArray(),
            ])->values()->toArray(),
        ]);

        // dd($courses->first());

        return Inertia::render('Students/MyCourses', [
            'courses' => $courses,
        ]);
    }

    private function calculateProgress($sections, $completedContentIds, $submittedContentIds): int {
        $allContents = $sections->flatMap->contents;
        $total       = $allContents->count();

        if ($total === 0) return 0;

        $completed = $allContents->filter(fn ($content) => match ($content->type) {
            'material'   => $completedContentIds->contains($content->id),
            'pre_assessment',
            'assignment' => $submittedContentIds->contains($content->id),
            default      => false,
        })->count();

        return (int) round(($completed / $total) * 100);
    }
}

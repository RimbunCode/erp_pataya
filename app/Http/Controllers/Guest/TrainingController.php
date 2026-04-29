<?php

namespace App\Http\Controllers\Guest;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Course;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TrainingController extends Controller {
    public function index(Request $request) {
        $courses = Course::with(['categories', 'creator'])
            ->where('is_published', true)
            ->when(
                $request->search,
                fn ($q) => $q->where('title', 'like', "%{$request->search}%")
                    ->orWhere('description', 'like', "%{$request->search}%"),
            )
            ->when(
                $request->level,
                fn ($q) => $q->where('level', $request->level),
            )
            ->when(
                $request->category,
                fn ($q) => $q->whereHas(
                    'categories',
                    fn ($q) => $q->where('slug', $request->category),
                ),
            )
            ->latest()
            ->get()
            ->map(fn ($course) => [
                'id'               => $course->id,
                'title'            => $course->title,
                'description'      => $course->description,
                'price'            => $course->price,
                'level'            => $course->level,
                'total_hours'      => $course->total_hours,
                'total_sessions'   => $course->total_sessions,
                'certificate_type' => $course->certificate_type,
                'is_published'     => $course->is_published,
                'instructor'       => $course->creator?->name,
                'categories'       => $course->categories->pluck('name'),
            ]);

        $categories = Category::orderBy('name')->get(['id', 'name', 'slug']);

        return Inertia::render('Guest/TrainingSection/TrainingCatalogue', [
            'courses'    => $courses,
            'categories' => $categories,
            'filters'    => $request->only(['search', 'level', 'category']),
        ]);
    }

    public function show(string $id) {
        $course = Course::with([
            'categories',
            'creator',
            'sections.contents',
            'notes' => fn ($q) => $q->latest()->take(5),
        ])
            ->where('is_published', true)
            ->findOrFail($id);

        return Inertia::render('Guest/TrainingSection/TrainingPreview', [
            'course' => [
                'id'               => $course->id,
                'title'            => $course->title,
                'description'      => $course->description,
                'price'            => $course->price,
                'level'            => $course->level,
                'language'         => $course->language,
                'total_hours'      => $course->total_hours,
                'total_sessions'   => $course->total_sessions,
                'certificate_type' => $course->certificate_type,
                'instructor'       => $course->creator?->name,
                'categories'       => $course->categories->pluck('name'),
                'sections'         => $course->sections->map(fn ($section) => [
                    'id'       => $section->id,
                    'title'    => $section->title,
                    'order'    => $section->order,
                    'contents' => $section->contents->map(fn ($content) => [
                        'id'          => $content->id,
                        'title'       => $content->title,
                        'type'        => $content->type,
                        'description' => $content->description,
                        'is_optional' => $content->is_optional,
                        'deadline'    => $content->deadline?->format('d M Y'),
                        'order'       => $content->order,
                    ]),
                ]),
            ],
        ]);
    }
}
<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class CourseController extends Controller {
    // ── Index ──────────────────────────────────────────────────────────────────
    public function index(Request $request) {
        $courses = Course::with(['categories'])
            ->where('created_by', Auth::id())
            ->when(
                $request->search,
                fn ($q) => $q->where('title', 'like', "%{$request->search}%"),
            )
            ->when(
                $request->status && $request->status !== 'all',
                fn ($q) => $q->where('is_published', $request->status === 'published'),
            )
            ->withCount('enrollments as students_count')
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
                'status'           => $course->is_published ? 'published' : 'draft',
                'students_count'   => $course->students_count,
                'categories'       => $course->categories->pluck('name'),
                'image'            => $course->image_url ?? null,
            ]);

        $categories = Category::orderBy('name')->get(['id', 'name', 'slug']);

        return Inertia::render('Instructors/ManageClasses', [
            'courses'    => $courses,
            'categories' => $categories,
            'filters'    => $request->only(['search', 'status']),
        ]);
    }

    // ── Show ───────────────────────────────────────────────────────────────────
    public function show(string $id) {
        $course = Course::with([
            'categories',
            'sections.contents',
            'sections.notes',
        ])
            ->where('created_by', Auth::id())
            ->withCount('enrollments as students_count')
            ->findOrFail($id);

        return Inertia::render('Instructors/CourseDetail', [
            'course' => [
                'id'               => $course->id,
                'title'            => $course->title,
                'description'      => $course->description,
                'price'            => $course->price,
                'level'            => $course->level,
                'total_hours'      => $course->total_hours,
                'total_sessions'   => $course->total_sessions,
                'certificate_type' => $course->certificate_type,
                'status'           => $course->is_published ? 'published' : 'draft',
                'students_count'   => $course->students_count,
                'categories'       => $course->categories->pluck('name'),
                'image'            => $course->image_url ?? null,
                'sections'         => $course->sections->sortBy('order')->map(fn ($section) => [
                    'id'       => $section->id,
                    'title'    => $section->title,
                    'order'    => $section->order,
                    'contents' => $section->contents->sortBy('order')->map(fn ($content) => [
                        'id'          => $content->id,
                        'title'       => $content->title,
                        'type'        => $content->type,
                        'description' => $content->description,
                        'deadline'    => $content->deadline?->format('d M Y'),
                        'is_optional' => $content->is_optional,
                        'order'       => $content->order,

                    ])->values(),
                    'notes'    => $section->notes->map(fn ($note) => [
                        'id'      => $note->id,
                        'message' => $note->message,
                    ]),
                ])->values(),
            ],
        ]);
    }

    // ── Store ──────────────────────────────────────────────────────────────────
    public function store(Request $request) {
        $validated = $request->validate([
            'title'                       => 'required|string|max:255',
            'description'                 => 'required|string',
            'price'                       => 'required|numeric|min:0',
            'level'                       => 'required|in:beginner,intermediate,advanced',
            'category'                    => 'required|string',
            'total_hours'                 => 'nullable|numeric|min:0',
            'total_sessions'              => 'nullable|integer|min:0',
            'certificate_type'            => 'nullable|in:professional,competency,attendance',
            'sections'                    => 'nullable|array',
            'sections.*.title'            => 'required|string|max:255',
            'sections.*.contents'         => 'nullable|array',
            'sections.*.contents.*.title' => 'required|string|max:255',
            'sections.*.contents.*.type'  => 'required|in:pre_assessment,material,assignment',
        ]);

        $course = Course::create([
            'title'            => $validated['title'],
            'description'      => $validated['description'],
            'price'            => $validated['price'],
            'level'            => $validated['level'],
            'total_hours'      => $validated['total_hours'] ?? null,
            'total_sessions'   => $validated['total_sessions'] ?? null,
            'certificate_type' => $validated['certificate_type'] ?? null,
            'is_published'     => false,
            'created_by'       => Auth::id(),
        ]);

        // Attach category
        $category = Category::where('name', $validated['category'])
            ->orWhere('slug', $validated['category'])
            ->first();
        if ($category) {
            $course->categories()->attach($category->id);
        }

        // Create sections & contents
        foreach ($validated['sections'] ?? [] as $si => $sectionData) {
            $section = $course->sections()->create([
                'title' => $sectionData['title'],
                'order' => $si + 1,
            ]);

            foreach ($sectionData['contents'] ?? [] as $ci => $contentData) {
                $section->contents()->create([
                    'title' => $contentData['title'],
                    'type'  => $contentData['type'],
                    'order' => $ci + 1,
                ]);
            }
        }

        return redirect()->route('instructor.classes.show', $course->id)
            ->with('success', 'Course created successfully.');
    }

    // ── Update ─────────────────────────────────────────────────────────────────
    public function update(Request $request, string $id) {
        $course = Course::where('created_by', Auth::id())->findOrFail($id);

        $validated = $request->validate([
            'title'            => 'required|string|max:255',
            'description'      => 'required|string',
            'price'            => 'required|numeric|min:0',
            'level'            => 'required|in:beginner,intermediate,advanced',
            'category'         => 'nullable|string',
            'total_hours'      => 'nullable|numeric|min:0',
            'total_sessions'   => 'nullable|integer|min:0',
            'certificate_type' => 'nullable|in:professional,competency,attendance',
        ]);

        $course->update([
            'title'            => $validated['title'],
            'description'      => $validated['description'],
            'price'            => $validated['price'],
            'level'            => $validated['level'],
            'total_hours'      => $validated['total_hours'] ?? $course->total_hours,
            'total_sessions'   => $validated['total_sessions'] ?? $course->total_sessions,
            'certificate_type' => $validated['certificate_type'] ?? $course->certificate_type,
        ]);

        if (! empty($validated['category'])) {
            $category = Category::where('name', $validated['category'])
                ->orWhere('slug', $validated['category'])
                ->first();
            if ($category) {
                $course->categories()->sync([$category->id]);
            }
        }

        return redirect()->route('instructor.classes.show', $course->id)
            ->with('success', 'Course updated successfully.');
    }

    // ── Toggle Publish ─────────────────────────────────────────────────────────
    public function togglePublish(string $id) {
        $course = Course::where('created_by', Auth::id())->findOrFail($id);
        $course->update(['is_published' => ! $course->is_published]);

        return back()->with(
            'success',
            $course->is_published ? 'Course published.' : 'Course unpublished.',
        );
    }
}
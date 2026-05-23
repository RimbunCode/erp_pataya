<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Core\File;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CourseController extends Controller {
    public function index(Request $request): Response {
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
            ->map(fn (Course $course) => $this->mapCourse($course));

        return Inertia::render('Instructors/ManageClasses', [
            'courses'    => $courses,
            'categories' => Category::orderBy('name')->get(['id', 'name', 'slug']),
            'filters'    => $request->only(['search', 'status']),
        ]);
    }

    // ── Show ───────────────────────────────────────────────────────────────────
    public function show(Course $course): Response {
        $course->load(['categories', 'sections.contents']);

        return Inertia::render('Instructors/CourseDetail', [
            'course'     => [
                ...$this->mapCourse($course),
                'sections' => $course->sections
                    ->sortBy('order')
                    ->map(fn ($section) => [
                        'id'       => $section->id,
                        'title'    => $section->title,
                        'order'    => $section->order,
                        'contents' => $section->contents
                            ->sortBy('order')
                            ->map(fn ($content) => [
                                'id'             => $content->id,
                                'title'          => $content->title,
                                'type'           => $content->type,
                                'description'    => $content->description,
                                'deadline'       => $content->deadline?->format('Y-m-d\TH:i'),
                                'deadline_label' => $content->deadlineLabel(),
                                'is_optional'    => $content->is_optional,
                                'order'          => $content->order,
                                'files'          => $content->files,
                            ])
                            ->values(),
                    ])
                    ->values(),
            ],
            'categories' => Category::orderBy('name')->get(['id', 'name', 'slug']),
        ]);
    }

    public function store(Request $request) {
        $validated = $request->validate([
            'title'                       => 'required|string|max:255',
            'description'                 => 'required|string',
            'price'                       => 'required|numeric|min:0',
            'discount_type'               => 'required|in:percentage,amount',
            'discount'                    => ['nullable', 'numeric', 'min:0', Rule::when(
                $request->input('discount_type') === 'percentage',
                ['max:100'],
                ['lte:price'],
            )],
            'level'                       => 'required|in:beginner,intermediate,advanced',
            'category'                    => 'required|string',
            'total_hours'                 => 'nullable|numeric|min:0',
            'total_sessions'              => 'nullable|integer|min:0',
            'certificate_type'            => 'nullable|in:professional,competency,attendance',
            'thumbnail'                   => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
            'sections'                    => 'nullable|array',
            'sections.*.title'            => 'required_with:sections|string|max:255',
            'sections.*.contents'         => 'nullable|array',
            'sections.*.contents.*.title' => 'required|string|max:255',
            'sections.*.contents.*.type'  => 'required|in:pre_assessment,material,assignment',
        ]);

        $thumbnailFileId = null;

        if ($request->hasFile('thumbnail')) {
            File::uploadFile($validated['thumbnail'], 'ImageCourse', function ($file) use (&$thumbnailFileId) {
                $thumbnailFileId = $file->id;
            }, ['is_public' => true]);
        }

        $course = Course::create([
            'title'            => $validated['title'],
            'description'      => $validated['description'],
            'price'            => $validated['price'],
            'discount_type'    => $validated['discount_type'],
            'discount'         => $validated['discount'] ?? 0,
            'level'            => $validated['level'],
            'total_hours'      => $validated['total_hours'] ?? 0,
            'total_sessions'   => $validated['total_sessions'] ?? 0,
            'certificate_type' => $validated['certificate_type'] ?? null,
            'thumbnail'        => $thumbnailFileId,
            'is_published'     => false,
            'created_by'       => Auth::id(),
        ]);

        $category = Category::where('slug', $validated['category'])
            ->orWhere('name', $validated['category'])
            ->first();

        if ($category) {
            $course->categories()->attach($category->id);
        }

        foreach ($validated['sections'] ?? [] as $index => $sectionData) {
            $section = $course->sections()->create([
                'title' => $sectionData['title'],
                'order' => $index + 1,
            ]);

            foreach ($sectionData['contents'] ?? [] as $ci => $contentData) {
                $section->contents()->create([
                    'title' => $contentData['title'],
                    'type'  => $contentData['type'],
                    'order' => $ci + 1,
                ]);
            }
        }

        return redirect()
            ->route('instructor.classes.show', $course->id)
            ->with('success', 'Course created successfully.');
    }

    public function update(Request $request, Course $course) {
        $validated = $request->validate([
            'title'            => 'required|string|max:255',
            'description'      => 'required|string',
            'price'            => 'required|numeric|min:0',
            'discount_type'    => 'required|in:percentage,amount',
            'discount'         => ['nullable', 'numeric', 'min:0', Rule::when(
                $request->input('discount_type') === 'percentage',
                ['max:100'],
                ['lte:price'],
            )],
            'level'            => 'required|in:beginner,intermediate,advanced',
            'category'         => 'nullable|string',
            'total_hours'      => 'nullable|numeric|min:0',
            'total_sessions'   => 'nullable|integer|min:0',
            'certificate_type' => 'nullable|in:professional,competency,attendance',
            'thumbnail'        => ['nullable', Rule::when(
                request()->hasFile('thumbnail'),
                ['image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
                ['string', 'max:255'], // bisa ganti jadi 'url' kalau harus URL
            ),],
        ]);

        $updateData = [
            'title'            => $validated['title'],
            'description'      => $validated['description'],
            'price'            => $validated['price'],
            'discount_type'    => $validated['discount_type'],
            'discount'         => $validated['discount'] ?? 0,
            'level'            => $validated['level'],
            'total_hours'      => $validated['total_hours'] ?? $course->total_hours,
            'total_sessions'   => $validated['total_sessions'] ?? $course->total_sessions,
            'certificate_type' => $validated['certificate_type'] ?? $course->certificate_type,
        ];

        // Upload hanya kalau ada file baru, thumbnail lama tidak disentuh
        if ($request->hasFile('thumbnail')) {
            File::uploadFile($validated['thumbnail'], 'ImageCourse', function ($file) use (&$updateData) {
                $updateData['thumbnail'] = $file->id;
            }, ['is_public' => true]);
        } elseif ($request->input('thumbnail') == 'delete') {
            $updateData['thumbnail'] = null;
        }

        $course->update($updateData);

        if (! empty($validated['category'])) {
            $category = Category::where('slug', $validated['category'])
                ->orWhere('name', $validated['category'])
                ->first();

            if ($category) {
                $course->categories()->sync([$category->id]);
            }
        }

        return redirect()
            ->route('instructor.classes.show', $course->id)
            ->with('success', 'Course updated successfully.');
    }

    // ── Toggle Publish ─────────────────────────────────────────────────────────
    public function togglePublish(Course $course) {
        $course->update(['is_published' => ! $course->is_published]);

        return back()->with(
            'success',
            $course->is_published ? 'Course published.' : 'Course unpublished.',
        );
    }

    public function updateThumbnail(Request $request, Course $course) {
        DB::beginTransaction();

        try {

            File::uploadFile($request, 'ImageCourse', function ($file) use ($course) {
                $course->update([
                    'thumbnail' => $file->id,
                ]);
            });
            DB::commit();

            return back();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    // ── Private Helpers ────────────────────────────────────────────────────────

    /**
     * Map a Course model ke array yang dikirim ke frontend.
     * Jika thumbnail null → kirim null, frontend akan render logo default sendiri.
     */
    private function mapCourse(Course $course): array {
        return [
            'id'               => $course->id,
            'title'            => $course->title,
            'description'      => $course->description,
            'price'            => $course->price,
            'discount_type'    => $course->discount_type,
            'discount'         => $course->discount,
            'level'            => $course->level,
            'total_hours'      => $course->total_hours,
            'total_sessions'   => $course->total_sessions,
            'certificate_type' => $course->certificate_type,
            'status'           => $course->is_published ? 'published' : 'draft',
            'students_count'   => $course->students_count ?? 0,
            'categories'       => $course->categories->pluck('name'),
            'thumbnail'        => $course->thumbnail,
        ];
    }
}

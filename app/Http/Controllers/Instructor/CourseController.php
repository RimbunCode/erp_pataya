<?php

namespace App\Http\Controllers\Instructor;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Core\File;
use App\Models\Course;
use App\Models\CoursePublishRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CourseController extends Controller {
    public function index(Request $request): Response {
        $courses = Course::with(['categories', 'latestPublishRequest'])
            ->where('created_by', Auth::id())
            ->when(
                $request->search,
                fn ($q) => $q->where('title', 'like', "%{$request->search}%"),
            )
            ->withCount('enrollments as students_count')
            ->latest()
            ->get()
            ->map(fn (Course $course) => $this->mapCourse($course));

        if ($request->filled('status') && $request->status !== 'all') {
            $courses = $courses
                ->filter(fn (array $course) => $course['status'] === $request->status)
                ->values();
        }

        return Inertia::render('Instructors/ManageClasses', [
            'courses'    => $courses,
            'categories' => Category::orderBy('name')->get(['id', 'name', 'slug']),
            'filters'    => $request->only(['search', 'status']),
        ]);
    }

    // ── Show ───────────────────────────────────────────────────────────────────
    public function show(Course $course): Response {
        if ($course->created_by !== Auth::id()) {
            abort(403);
        }

        $course->load(['categories', 'sections.contents', 'latestPublishRequest']);

        return Inertia::render('Instructors/CourseDetail', [
            'course' => [
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
                                'url'            => $content->url,
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
            'title'         => 'required|string|max:255',
            'description'   => 'required|string',
            'price'         => 'required|numeric|min:0',
            'discount_type' => 'required|in:percentage,amount',
            'discount'      => ['nullable', 'numeric', 'min:0', Rule::when(
                $request->input('discount_type') === 'percentage',
                ['max:100'],
                ['lte:price'],
            )],
            'level'    => 'required|in:beginner,intermediate,advanced',
            'category' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! $this->categoryExists((string) $value)) {
                        $fail('Kategori tidak ditemukan.');
                    }
                },
            ],
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
        $category = $this->resolveCategory((string) $validated['category']);

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

        $course->categories()->attach($category->id);

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
        if ($course->created_by !== Auth::id()) {
            abort(403);
        }

        $validated = $request->validate([
            'title'         => 'required|string|max:255',
            'description'   => 'required|string',
            'price'         => 'required|numeric|min:0',
            'discount_type' => 'required|in:percentage,amount',
            'discount'      => ['nullable', 'numeric', 'min:0', Rule::when(
                $request->input('discount_type') === 'percentage',
                ['max:100'],
                ['lte:price'],
            )],
            'level'    => 'required|in:beginner,intermediate,advanced',
            'category' => [
                'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($value === null || trim((string) $value) === '') {
                        return;
                    }

                    if (! $this->categoryExists((string) $value)) {
                        $fail('Kategori tidak ditemukan.');
                    }
                },
            ],
            'total_hours'      => 'nullable|numeric|min:0',
            'total_sessions'   => 'nullable|integer|min:0',
            'certificate_type' => 'nullable|in:professional,competency,attendance',
            'thumbnail'        => ['nullable', Rule::when(
                request()->hasFile('thumbnail'),
                ['image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
                ['string', 'max:255'], // bisa ganti jadi 'url' kalau harus URL
            ), ],
        ]);

        $isPricingChanged = (float) $validated['price'] !== (float) $course->price
            || (float) ($validated['discount'] ?? 0) !== (float) $course->discount
            || $validated['discount_type'] !== $course->discount_type;

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

        if ($course->is_published && $isPricingChanged) {
            $hasPendingRequest = CoursePublishRequest::query()
                ->where('course_id', $course->id)
                ->where('status', FormStatus::PENDING->value)
                ->exists();

            if ($hasPendingRequest) {
                throw ValidationException::withMessages([
                    'course' => 'Masih ada request perubahan harga/diskon yang menunggu review admin.',
                ]);
            }

            // Keep live catalogue pricing unchanged while pending approval.
            $updateData['price']         = $course->price;
            $updateData['discount']      = $course->discount;
            $updateData['discount_type'] = $course->discount_type;
        }

        // Upload hanya kalau ada file baru, thumbnail lama tidak disentuh
        if ($request->hasFile('thumbnail')) {
            File::uploadFile($validated['thumbnail'], 'ImageCourse', function ($file) use (&$updateData) {
                $updateData['thumbnail'] = $file->id;
            }, ['is_public' => true]);
        } elseif ($request->input('thumbnail') == 'delete') {
            $updateData['thumbnail'] = null;
        }

        DB::transaction(function () use ($course, $updateData, $validated, $isPricingChanged): void {
            $course->update($updateData);

            if ($course->is_published && $isPricingChanged) {
                CoursePublishRequest::query()->create([
                    'course_id'               => $course->id,
                    'requested_by'            => Auth::id(),
                    'status'                  => FormStatus::PENDING->value,
                    'submitted_price'         => $validated['price'],
                    'submitted_discount'      => $validated['discount'] ?? 0,
                    'submitted_discount_type' => $validated['discount_type'],
                ]);
            }
        });

        if (! empty($validated['category'])) {
            $category = $this->resolveCategory((string) $validated['category']);
            $course->categories()->sync([$category->id]);
        }

        return redirect()
            ->route('instructor.classes.show', $course->id)
            ->with('success', 'Course updated successfully.');
    }

    // ── Toggle Publish ─────────────────────────────────────────────────────────
    public function togglePublish(Course $course) {
        if ($course->created_by !== Auth::id()) {
            abort(403);
        }

        if ($course->is_published) {
            $course->update(['is_published' => false]);

            return back()->with('success', 'Course unpublished.');
        }

        $hasPendingRequest = CoursePublishRequest::query()
            ->where('course_id', $course->id)
            ->where('status', FormStatus::PENDING->value)
            ->exists();

        if ($hasPendingRequest) {
            throw ValidationException::withMessages([
                'course' => 'Masih ada request publish yang menunggu review admin.',
            ]);
        }

        $latestRejectedRequest = CoursePublishRequest::query()
            ->where('course_id', $course->id)
            ->where('status', FormStatus::REJECTED->value)
            ->latest('created_at')
            ->first();

        if (
            $latestRejectedRequest?->reviewed_at !== null
            && $course->updated_at !== null
            && $course->updated_at->lte($latestRejectedRequest->reviewed_at)
        ) {
            throw ValidationException::withMessages([
                'course' => 'Perbarui info course terlebih dahulu sebelum submit publish ulang.',
            ]);
        }

        CoursePublishRequest::query()->create([
            'course_id'               => $course->id,
            'requested_by'            => Auth::id(),
            'status'                  => FormStatus::PENDING->value,
            'submitted_price'         => $course->price,
            'submitted_discount'      => $course->discount,
            'submitted_discount_type' => $course->discount_type,
        ]);

        return back()->with(
            'success',
            'Request publish course berhasil dikirim ke admin.',
        );
    }

    public function updateThumbnail(Request $request, Course $course) {
        if ($course->created_by !== Auth::id()) {
            abort(403);
        }

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
        $latestPublishRequest          = $course->latestPublishRequest;
        $hasPendingPriceChangeApproval = $course->is_published
            && $latestPublishRequest?->status === FormStatus::PENDING->value
            && (
                (float) ($latestPublishRequest->submitted_price ?? $course->price) !== (float) $course->price
                || (float) ($latestPublishRequest->submitted_discount ?? $course->discount) !== (float) $course->discount
                || (string) ($latestPublishRequest->submitted_discount_type ?? $course->discount_type) !== (string) $course->discount_type
            );

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
            'status'           => $this->resolveStatus($course),
            'students_count'   => $course->students_count ?? 0,
            'categories'       => $course->categories->pluck('name'),
            'thumbnail'        => $course->thumbnail,
            'updated_at'       => $course->updated_at?->toIso8601String(),
            'rejection_reason' => $latestPublishRequest?->status === FormStatus::REJECTED->value
                ? $latestPublishRequest->rejection_reason
                : null,
            'requested_at' => $latestPublishRequest?->status === FormStatus::PENDING->value
                ? $latestPublishRequest->created_at?->toIso8601String()
                : null,
            'has_pending_price_change_approval' => $hasPendingPriceChangeApproval,
            'pending_price_change'              => $hasPendingPriceChangeApproval ? [
                'submitted_price'         => (float) $latestPublishRequest->submitted_price,
                'submitted_discount'      => (float) $latestPublishRequest->submitted_discount,
                'submitted_discount_type' => (string) $latestPublishRequest->submitted_discount_type,
                'requested_at'            => $latestPublishRequest->created_at?->toIso8601String(),
            ] : null,
        ];
    }

    private function resolveStatus(Course $course): string {
        if ($course->is_published) {
            return 'published';
        }

        $latestPublishRequestStatus = (string) ($course->latestPublishRequest?->status ?? '');

        if ($latestPublishRequestStatus === FormStatus::PENDING->value) {
            return 'pending';
        }

        if ($latestPublishRequestStatus === FormStatus::REJECTED->value) {
            return 'rejected';
        }

        return 'draft';
    }

    private function categoryExists(string $categoryInput): bool {
        return Category::query()
            ->where('slug', $categoryInput)
            ->orWhere('name', $categoryInput)
            ->exists();
    }

    private function resolveCategory(string $categoryInput): Category {
        return Category::query()
            ->where('slug', $categoryInput)
            ->orWhere('name', $categoryInput)
            ->firstOrFail();
    }
}

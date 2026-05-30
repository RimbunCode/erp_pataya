<?php

namespace App\Http\Controllers\Guest;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Course;
use App\Models\Enrollment;
use App\Services\Guest\GuestPageContentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class TrainingController extends Controller { public function __construct(private GuestPageContentService $guestPageContentService) {}

    public function index(Request $request): Response {
        $user = Auth::user();

        // Ambil role user yang sedang login
        $role = $user?->roles->pluck('name')->first();

        $query = Course::with(['categories', 'creator'])
            ->where('is_published', true);

        if ($role === 'student' && $user) {
            // Sembunyikan course yang sudah di-enroll oleh student ini
            $enrolledCourseIds = $user->enrollments()->pluck('course_id');
            $query->whereNotIn('id', $enrolledCourseIds);

        } elseif ($role === 'instructor' && $user) {
            // Hanya tampilkan course milik instructor ini
            $query->where('created_by', $user->id);
        }

        $courses = $query->latest()->get()->map(fn ($course) => [
            'id'               => $course->id,
            'title'            => $course->title,
            'description'      => $course->description,
            'discount_type'    => $course->discount_type,
            'discount'         => $course->discount,
            'price'            => $course->price,
            'level'            => $course->level,
            'total_hours'      => $course->total_hours,
            'total_sessions'   => $course->total_sessions,
            'certificate_type' => $course->certificate_type,
            'is_published'     => $course->is_published,
            'instructor'       => $course->creator?->name,
            'thumbnail'        => $course->thumbnail,
            'categories'       => $course->categories->pluck('name'),
        ]);

        $categories = Category::orderBy('name')->get(['id', 'name', 'slug']);

        return Inertia::render('Guest/CourseSection/CourseCatalogue', [
            'courses'    => $courses,
            'categories' => $categories,
            'filters'    => $request->only(['search', 'level', 'category', 'certification']),
            'content'    => $this->guestPageContentService->resolve(),
        ]);
    }

    public function show(Course $course): Response {
        $user      = Auth::user();
        $isStudent = $user !== null && $user->roles->pluck('name')->contains('student');

        $course->load(['categories', 'creator', 'sections.contents']);

        $enrollmentStatus = '';
        $rejectionReason  = null;
        $isEnrolled       = false;

        if ($isStudent) {
            $enrollment = Enrollment::query()
                ->with('payment')
                ->where('user_id', $user->id)
                ->where('course_id', $course->id)
                ->first();

            if ($enrollment !== null) {
                $enrollmentStatus = (string) $enrollment->status;
                $isEnrolled       = $enrollmentStatus === '' || $enrollmentStatus === FormStatus::ACTIVE->value;
                $rejectionReason  = $enrollment->payment?->rejection_reason;
            }
        }

        return Inertia::render('Guest/CourseSection/CoursePreview', [
            'course'           => [
                'id'               => $course->id,
                'title'            => $course->title,
                'description'      => $course->description,
                'discount_type'    => $course->discount_type,
                'discount'         => $course->discount,
                'price'            => $course->price,
                'level'            => $course->level,
                'language'         => $course->language,
                'total_hours'      => $course->total_hours,
                'total_sessions'   => $course->total_sessions,
                'certificate_type' => $course->certificate_type,
                'instructor'       => $course->creator?->name,
                'thumbnail'        => $course->thumbnail,
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
                        'deadline'    => $content->deadlineLabel(),
                        'order'       => $content->order,
                    ]),
                ]),
            ],
            'isLoggedIn'       => $isStudent,
            'isEnrolled'       => $isEnrolled,
            'enrollmentStatus' => $enrollmentStatus,
            'rejectionReason'  => $rejectionReason,
            'content'          => $this->guestPageContentService->resolve(),
        ]);
    }
}

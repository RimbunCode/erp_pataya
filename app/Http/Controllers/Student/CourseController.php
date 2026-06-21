<?php

namespace App\Http\Controllers\Student;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class CourseController extends Controller {
    public function index() {
        $user = Auth::user();

        $enrolledIds = Enrollment::where('user_id', $user->id)
            ->pluck('course_id')
            ->toArray();

        $cartIds = Cart::where('user_id', $user->id)
            ->pluck('course_id')
            ->toArray();

        $courses = Course::with(['categories', 'creator'])
            ->where('is_published', true)
            ->whereNotIn('id', $enrolledIds)
            ->get()
            ->map(function ($course) use ($cartIds) {
                $categoryNames = $course->categories->pluck('name');

                return [
                    'id'             => $course->id,
                    'title'          => $course->title,
                    'description'    => $course->description,
                    'price'          => $course->price,
                    'level'          => $course->level,
                    'total_hours'    => $course->total_hours,
                    'total_sessions' => $course->total_sessions,
                    'certified'      => ! is_null($course->certificate_type),
                    'rating'         => 4.8,
                    'reviews'        => 0,
                    'instructor'     => $course->creator?->name,
                    'categories'     => $categoryNames,
                    'tags'           => $categoryNames->take(2)->values()->toArray(),
                    'thumbnail'      => $course->thumbnail
                        ? asset('storage/' . $course->thumbnail)
                        : null,
                    'inCart' => in_array($course->id, $cartIds),
                ];
            });

        $cartCourses = Course::with(['creator'])
            ->whereIn('id', $cartIds)
            ->get()
            ->map(fn ($course) => [
                'id'         => $course->id,
                'title'      => $course->title,
                'price'      => $course->price,
                'instructor' => $course->creator?->name,
                'image'      => $course->thumbnail
                    ? asset('storage/' . $course->thumbnail)
                    : null,
            ]);

        return Inertia::render('Students/CourseCatalogue', [
            'courses'     => $courses,
            'cartCourses' => $cartCourses,
        ]);
    }

    public function show(Course $course) {
        $user = Auth::user();

        $course->load(['categories', 'creator', 'sections.contents']);

        $enrollment = null;
        if ($user !== null) {
            $enrollment = Enrollment::query()
                ->with('payment')
                ->where('user_id', $user->id)
                ->where('course_id', $course->id)
                ->first();
        }

        $enrollmentStatus = (string) ($enrollment?->status ?? '');
        $isEnrolled       = $enrollment !== null
            && ($enrollmentStatus === '' || $enrollmentStatus === FormStatus::ACTIVE->value);

        return Inertia::render('Students/CoursePreview', [
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
                        'url'         => $content->url,
                        'order'       => $content->order,
                    ]),
                ]),
            ],
            'isLoggedIn'       => $user !== null,
            'isEnrolled'       => $isEnrolled,
            'enrollmentStatus' => $enrollmentStatus,
            'rejectionReason'  => $enrollment?->payment?->rejection_reason,
        ]);
    }
}

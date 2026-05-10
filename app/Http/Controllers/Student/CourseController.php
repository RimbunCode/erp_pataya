<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class CourseController extends Controller {
    public function index() {
        $user = Auth::user();

        // Ambil course ID yang sudah dienroll
        $enrolledIds = Enrollment::where('user_id', $user->id)
            ->pluck('course_id')
            ->toArray();

        // Ambil course ID yang ada di cart
        $cartIds = Cart::where('user_id', $user->id)
            ->pluck('course_id')
            ->toArray();

        $courses = Course::with(['categories', 'creator'])
            ->where('is_published', true)
            ->whereNotIn('id', $enrolledIds)
            ->get()
            ->map(fn ($course) => [
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
                'categories'     => $course->categories->pluck('name'),
                'tags'           => $course->categories->pluck('name')->take(2)->toArray(),
                'thumbnail'      => $course->thumbnail
                    ? asset('storage/' . $course->thumbnail)
                    : null,
                'inCart'         => in_array($course->id, $cartIds),
            ]);

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

        return Inertia::render('Students/WishlistCart', [
            'courses'     => $courses,
            'cartCourses' => $cartCourses,
        ]);
    }
}
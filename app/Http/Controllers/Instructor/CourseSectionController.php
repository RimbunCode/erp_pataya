<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseSection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CourseSectionController extends Controller {
    public function store(Request $request, Course $course) {
        if ($course->created_by !== Auth::id()) {
            abort(403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $order = $course->sections()->max('order') + 1;

        $course->sections()->create([
            'title' => $validated['title'],
            'order' => $order,
        ]);

        return back()->with('success', 'Section added.');
    }

    // PATCH /instructor/classes/{courseId}/sections/{sectionId}
    public function update(Request $request, CourseSection $section) {
        if ($section->course->created_by !== Auth::id()) {
            abort(403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $section->update(['title' => $validated['title']]);

        return back()->with('success', 'Section updated.');
    }

    // DELETE /instructor/classes/{courseId}/sections/{sectionId}
    public function destroy(CourseSection $section) {
        if ($section->course->created_by !== Auth::id()) {
            abort(403);
        }

        $section->delete();

        return back()->with('success', 'Section deleted.');
    }
}
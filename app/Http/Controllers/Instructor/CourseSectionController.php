<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseSection;
use Illuminate\Http\Request;

class CourseSectionController extends Controller {
    public function store(Request $request, Course $course) {
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
        $validated = $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $section->update(['title' => $validated['title']]);

        return back()->with('success', 'Section updated.');
    }

    // DELETE /instructor/classes/{courseId}/sections/{sectionId}
    public function destroy(CourseSection $section) {
        $section->delete();

        return back()->with('success', 'Section deleted.');
    }
}
<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\CourseNote;
use App\Models\CourseSection;
use App\Notifications\NewCourseNoteNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;

class CourseSectionNoteController extends Controller {
    // POST /instructor/classes/{courseId}/sections/{sectionId}/notes
    public function store(Request $request, CourseSection $section) {
        $validated = $request->validate([
            'content' => 'required|string',
        ]);

        // course_notes berelasi ke course_id (bukan section_id per DBML)
        // kita simpan course_id dari section, dan tandai via title/type jika perlu
        $note = CourseNote::create([
            'course_id'  => $section->course_id,
            'section_id' => $section->id,
            'title'      => "Section: {$section->title}",
            'message'    => $validated['content'],
            'type'       => 'info',
            'is_urgent'  => false,
            'created_by' => Auth::id(),
        ]);

        // Notifikasi ke semua student yang enrolled di course ini
        $enrolledStudents = $section->course
            ?->enrollments()
            ?->with('user')
            ?->get()
            ?->pluck('user')
            ?->filter() ?? collect();

        if ($enrolledStudents->isNotEmpty()) {
            Notification::send($enrolledStudents, new NewCourseNoteNotification($note));
        }

        return back()->with('success', 'Note added.');
    }

    // DELETE /instructor/classes/{courseId}/sections/{sectionId}/notes/{id}
    public function destroy(CourseNote $note) {
        $note->delete();

        return back()->with('success', 'Note deleted.');
    }
}
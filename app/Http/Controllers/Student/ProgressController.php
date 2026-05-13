<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\CourseContent;
use App\Models\UserProgress;

class ProgressController extends Controller {
    public function store(CourseContent $content) {
        // Hanya material yang bisa di mark as done manual
        if ($content->type !== 'material') {
            abort(403);
        }

        UserProgress::firstOrCreate([
            'user_id'    => auth()->id(),
            'content_id' => $content->id,
        ], [
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        return back();
    }
}
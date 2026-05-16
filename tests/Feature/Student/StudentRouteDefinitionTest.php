<?php

namespace Tests\Feature\Student;

use Tests\TestCase;

class StudentRouteDefinitionTest extends TestCase {
    public function test_submission_store_route_uses_single_student_prefix(): void {
        $url = route('student.submissions.store', ['content' => 123], false);

        $this->assertSame('/student/submissions/123', $url);
    }

    public function test_progress_store_route_uses_single_student_prefix(): void {
        $url = route('student.progress.store', ['content' => 123], false);

        $this->assertSame('/student/progress/123', $url);
    }

    public function test_submission_file_destroy_route_uses_single_student_prefix(): void {
        $url = route('student.submissions.files.destroy', ['content' => 123, 'file' => 456], false);

        $this->assertSame('/student/submissions/123/files/456', $url);
    }
}

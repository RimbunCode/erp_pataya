<?php

namespace Tests\Feature\Student;

use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentSubmissionFlowTest extends TestCase {
    use RefreshDatabase;

    public function test_student_can_submit_before_deadline(): void {
        $student = User::factory()->create();
        $content = $this->createSubmissionContent(now()->addHour());

        $response = $this->actingAs($student)->post(route('student.submissions.store', $content), [
            'notes'   => 'ready',
            'filesId' => [$this->createFile($student)->id],
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('submissions', [
            'user_id'    => $student->id,
            'content_id' => $content->id,
        ]);
    }

    public function test_student_cannot_submit_after_deadline(): void {
        $student = User::factory()->create();
        $content = $this->createSubmissionContent(now()->subHour());

        $response = $this->actingAs($student)->post(route('student.submissions.store', $content), [
            'notes'   => 'late',
            'filesId' => [$this->createFile($student)->id],
        ]);

        $response->assertSessionHasErrors('submission');

        $this->assertDatabaseMissing('submissions', [
            'user_id'    => $student->id,
            'content_id' => $content->id,
        ]);
    }

    public function test_student_cannot_submit_material_content(): void {
        $student = User::factory()->create();
        $content = $this->createContent('material', now()->addHour());

        $response = $this->actingAs($student)->post(route('student.submissions.store', $content), [
            'notes'   => 'invalid',
            'filesId' => [$this->createFile($student)->id],
        ]);

        $response->assertUnprocessable();
    }

    public function test_student_can_hard_delete_submission_file_before_deadline_and_delete_submission_when_last_file(): void {
        $student = User::factory()->create();
        $content = $this->createSubmissionContent(now()->addHour());
        $file    = $this->createFile($student);

        $submission = Submission::create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'notes'        => 'test',
            'status'       => 'submitted',
            'submitted_at' => now(),
        ]);

        Fileable::create([
            'file_id'       => $file->id,
            'fileable_id'   => $submission->id,
            'fileable_type' => Submission::class,
        ]);

        $response = $this->actingAs($student)->delete(route('student.submissions.files.destroy', [
            'content' => $content->id,
            'file'    => $file->id,
        ]));

        $response->assertRedirect();

        $this->assertDatabaseMissing('fileables', [
            'file_id'       => $file->id,
            'fileable_id'   => $submission->id,
            'fileable_type' => Submission::class,
        ]);
        $this->assertDatabaseMissing('submissions', [
            'id' => $submission->id,
        ]);
    }

    public function test_student_cannot_delete_submission_file_after_deadline(): void {
        $student = User::factory()->create();
        $content = $this->createSubmissionContent(now()->subHour());
        $file    = $this->createFile($student);

        $submission = Submission::create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'status'       => 'submitted',
            'submitted_at' => now(),
        ]);

        Fileable::create([
            'file_id'       => $file->id,
            'fileable_id'   => $submission->id,
            'fileable_type' => Submission::class,
        ]);

        $response = $this->actingAs($student)->delete(route('student.submissions.files.destroy', [
            'content' => $content->id,
            'file'    => $file->id,
        ]));

        $response->assertSessionHasErrors('submission');

        $this->assertDatabaseHas('fileables', [
            'file_id'       => $file->id,
            'fileable_id'   => $submission->id,
            'fileable_type' => Submission::class,
        ]);
    }

    public function test_my_courses_payload_contains_deadline_label_and_can_manage_submission(): void {
        $student = User::factory()->create();
        $content = $this->createSubmissionContent(now()->addHour());
        $this->enrollStudentToContentCourse($student, $content);

        $response = $this->actingAs($student)->get(route('student.courses.index'));
        $response->assertOk();

        $page = $response->viewData('page');

        $this->assertNotNull(data_get($page, 'props.courses.0.sections.0.contents.0.deadline_label'));
        $this->assertTrue(data_get($page, 'props.courses.0.sections.0.contents.0.can_manage_submission'));
    }

    private function createSubmissionContent($deadline): CourseContent {
        return $this->createContent('assignment', $deadline);
    }

    private function createContent(string $type, $deadline): CourseContent {
        $instructor = User::factory()->create();
        $course     = Course::create([
            'title'          => 'Course A',
            'description'    => 'desc',
            'price'          => 10000,
            'is_published'   => true,
            'level'          => 'beginner',
            'language'       => 'id',
            'total_hours'    => 1,
            'total_sessions' => 1,
            'created_by'     => $instructor->id,
        ]);

        $section = CourseSection::create([
            'course_id' => $course->id,
            'title'     => 'Section A',
            'order'     => 1,
        ]);

        return CourseContent::create([
            'section_id'  => $section->id,
            'title'       => 'Content A',
            'type'        => $type,
            'deadline'    => $deadline,
            'is_optional' => false,
            'is_required' => true,
            'order'       => 1,
        ]);
    }

    private function enrollStudentToContentCourse(User $student, CourseContent $content): void {
        Enrollment::create([
            'user_id'     => $student->id,
            'course_id'   => $content->section->course_id,
            'enrolled_at' => now(),
        ]);
    }

    private function createFile(User $user): File {
        return File::create([
            'name'          => 'answer',
            'path'          => 'files/answer.pdf',
            'extension'     => 'pdf',
            'mime_type'     => 'application/pdf',
            'is_public'     => false,
            'created_by_id' => $user->id,
        ]);
    }
}

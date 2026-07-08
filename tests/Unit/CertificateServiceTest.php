<?php

namespace Tests\Unit;

use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\EnrollmentEvaluation;
use App\Models\User\Role;
use App\Models\User\User;
use App\Models\UserProgress;
use App\Services\CertificateService;
use App\Services\GoogleDocsService;
use App\Services\GradingService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class CertificateServiceTest extends TestCase {
    private CertificateService $service;

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);

        // Mock GoogleDocsService agar tidak hit Google API saat unit test
        $googleMock = Mockery::mock(GoogleDocsService::class);
        $googleMock->shouldReceive('generateAndUploadCertificate')->andReturn([
            'file_id'      => 'mock-file-id',
            'view_url'     => 'https://drive.google.com/file/d/mock/view',
            'download_url' => 'https://drive.google.com/uc?export=download&id=mock',
        ]);
        $this->app->instance(GoogleDocsService::class, $googleMock);
        $this->service = new CertificateService();
    }

    public function test_course_is_completed_when_all_required_contents_done(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        $this->assertTrue($this->service->isCourseCompleted($enrollment));
    }

    public function test_course_is_not_completed_when_some_content_still_pending(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course  = $this->makeCourse($instructor);
        $section = $this->makeSection($course);
        $this->makeContent($section, 'material', 1);
        $content2   = $this->makeContent($section, 'material', 2);
        $enrollment = $this->makeEnrollment($student, $course);

        // hanya content2 yang selesai, content1 belum
        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content2->id,
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        $this->assertFalse($this->service->isCourseCompleted($enrollment));
    }

    public function test_course_is_not_completed_when_no_progress_at_all(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        $this->assertFalse($this->service->isCourseCompleted($enrollment));
    }

    public function test_optional_content_is_excluded_from_completion_check(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $required   = $this->makeContent($section, 'material', 1, isOptional: false);
        $this->makeContent($section, 'material', 2, isOptional: true); // ini opsional
        $enrollment = $this->makeEnrollment($student, $course);

        // hanya selesaikan yang required
        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $required->id,
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        // course dianggap selesai meski konten opsional belum dikerjakan
        $this->assertTrue($this->service->isCourseCompleted($enrollment));
    }

    public function test_course_with_no_required_content_is_not_completed(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $this->makeContent($section, 'material', 1, isOptional: true); // semua opsional
        $enrollment = $this->makeEnrollment($student, $course);

        // tidak ada konten required → tidak bisa dianggap complete
        $this->assertFalse($this->service->isCourseCompleted($enrollment));
    }

    public function test_verify_returns_certificate_by_credential_id(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $enrollment = $this->makeEnrollment($student, $course);
        $cert       = $this->makeCertificateRecord($enrollment, 'INK-2026-VER-001');

        $found = $this->service->verify('INK-2026-VER-001');

        $this->assertNotNull($found);
        $this->assertSame($cert->id, $found->id);
    }

    public function test_verify_returns_null_for_unknown_credential_id(): void {
        $found = $this->service->verify('INK-DOES-NOT-EXIST');

        $this->assertNull($found);
    }

    public function test_issue_certificate_throws_when_course_not_completed(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Course is not yet completed.');

        $this->service->issueCertificate($enrollment);
    }

    public function test_issue_certificate_returns_existing_certificate_if_already_issued(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $enrollment = $this->makeEnrollment($student, $course);
        $existing   = $this->makeCertificateRecord($enrollment, 'INK-2026-EXS-001');

        $result = $this->service->issueCertificate($enrollment);

        $this->assertSame($existing->id, $result->id);
        $this->assertSame(1, Certificate::count());
    }

    public function test_issue_certificate_throws_when_evaluation_not_final(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Evaluasi peserta belum final.');

        $this->service->issueCertificate($enrollment);
    }

    public function test_issue_certificate_throws_when_not_passed(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        EnrollmentEvaluation::query()->create([
            'enrollment_id' => $enrollment->id,
            'is_passed'     => false,
            'status'        => 'final',
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Peserta belum memenuhi syarat lulus.');

        $this->service->issueCertificate($enrollment);
    }

    public function test_issue_certificate_succeeds_when_evaluation_final_and_passed(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        EnrollmentEvaluation::query()->create([
            'enrollment_id' => $enrollment->id,
            'is_passed'     => true,
            'status'        => 'final',
        ]);

        $certificate = $this->service->issueCertificate($enrollment);

        $this->assertNotNull($certificate);
        $this->assertSame('active', $certificate->status);
    }

    public function test_issue_from_template_throws_when_not_final(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $enrollment = $this->makeEnrollment($student, $course);
        $template   = $this->makeInternalTemplate($instructor);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Evaluasi peserta belum final.');

        $this->service->issueFromTemplate($enrollment, $template, new GradingService($this->service));
    }

    public function test_issue_from_template_generates_pdf_with_snapshot(): void {
        Storage::fake();

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);
        $template   = $this->makeInternalTemplate($instructor);

        EnrollmentEvaluation::query()->create([
            'enrollment_id' => $enrollment->id,
            'is_passed'     => true,
            'status'        => 'final',
            'final_score'   => 90,
            'grade'         => 'A',
        ]);

        $certificate = $this->service->issueFromTemplate($enrollment, $template, new GradingService($this->service));

        $this->assertSame('template', $certificate->source);
        $this->assertNotNull($certificate->file_path);
        $this->assertNotNull($certificate->snapshot);
        $this->assertSame(90.0, (float) $certificate->snapshot['finalScore']);
        Storage::assertExists($certificate->file_path);
    }

    public function test_issue_from_template_generates_barcode_and_qr_in_snapshot(): void {
        Storage::fake();

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);
        $template   = $this->makeInternalTemplate($instructor);

        EnrollmentEvaluation::query()->create([
            'enrollment_id' => $enrollment->id,
            'is_passed'     => true,
            'status'        => 'final',
        ]);

        $certificate = $this->service->issueFromTemplate($enrollment, $template, new GradingService($this->service));

        $this->assertNotEmpty($certificate->snapshot['barcode1dBase64']);
        $this->assertNotEmpty($certificate->snapshot['qrCodeBase64']);
        $this->assertNotEmpty($certificate->snapshot['verifyUrl']);
        $this->assertStringContainsString($certificate->credential_id, $certificate->snapshot['verifyUrl']);
        $this->assertStringContainsString('/verify/', $certificate->snapshot['verifyUrl']);
    }

    // ── Helpers ───────────────────────────────────────

    private function makeInstructorAndStudent(): array {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');
        return [$instructor, $student];
    }

    private function assignRole(User $user, string $roleName): void {
        $role = Role::query()->firstOrCreate(
            ['name' => $roleName],
            ['description' => "{$roleName} role", 'is_disabled' => false],
        );
        $user->roles()->syncWithoutDetaching([$role->id]);
    }

    private function makeCourse(User $instructor): Course {
        return Course::query()->create([
            'title'          => 'Unit Test Course',
            'description'    => 'Description',
            'price'          => 0,
            'level'          => 'beginner',
            'total_hours'    => 1,
            'total_sessions' => 1,
            'created_by'     => $instructor->id,
        ]);
    }

    private function makeSection(Course $course): CourseSection {
        return CourseSection::query()->create([
            'course_id' => $course->id,
            'title'     => 'Section 1',
            'order'     => 1,
        ]);
    }

    private function makeContent(
        CourseSection $section,
        string $type,
        int $order = 1,
        bool $isOptional = false,
    ): CourseContent {
        return CourseContent::query()->create([
            'section_id'  => $section->id,
            'title'       => "Content {$type} {$order}",
            'type'        => $type,
            'order'       => $order,
            'is_optional' => $isOptional,
        ]);
    }

    private function makeEnrollment(User $student, Course $course): Enrollment {
        return Enrollment::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
            'status'    => 'active',
        ]);
    }

    private function makeInternalTemplate(User $creator): CertificateTemplate {
        return CertificateTemplate::query()->create([
            'name'         => 'Template Internal',
            'created_by'   => $creator->id,
            'is_active'    => true,
            'placeholders' => [],
        ]);
    }

    private function makeCertificateRecord(Enrollment $enrollment, string $credentialId): Certificate {
        return Certificate::query()->create([
            'enrollment_id'       => $enrollment->id,
            'user_id'             => $enrollment->user_id,
            'course_id'           => $enrollment->course_id,
            'credential_id'       => $credentialId,
            'issued_at'           => now(),
            'gdrive_file_id'      => 'fake-id',
            'gdrive_view_url'     => 'https://drive.google.com/file/d/fake/view',
            'gdrive_download_url' => 'https://drive.google.com/uc?export=download&id=fake',
            'status'              => 'active',
        ]);
    }

    /** @return array<int, string> */
    private function requiredMigrationPaths(): array {
        return [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/0001_01_01_000000_create_preferences_table.php',
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_150339_create_permissions_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2026_04_26_075938_create_courses_table.php',
            'database/migrations/2026_04_26_075939_create_categories_table.php',
            'database/migrations/2026_04_28_074544_create_course_category_table.php',
            'database/migrations/2026_04_28_074634_create_payments_table.php',
            'database/migrations/2026_04_28_074652_create_enrollments_table.php',
            'database/migrations/2026_04_28_074531_create_course_sections_table.php',
            'database/migrations/2026_04_28_074547_create_course_contents_table.php',
            'database/migrations/2026_04_28_074548_create_course_content_files_table.php',
            'database/migrations/2026_04_28_074710_create_user_progress_table.php',
            'database/migrations/2026_04_29_074108_create_submissions_table.php',
            'database/migrations/2026_05_22_134117_add_status_to_enrollments_table.php',
            'database/migrations/2026_05_22_134117_add_rejection_reason_to_payments_table.php',
            'database/migrations/2026_06_07_182309_add_url_to_course_contents_table.php',
            'database/migrations/2026_06_08_024831_add_grade_feedback_to_submissions_table.php',
            'database/migrations/2026_06_17_143845_add_deadline_time_to_course_contents_table.php',
            'database/migrations/2026_06_27_000001_create_certificate_templates_table.php',
            'database/migrations/2026_06_27_000002_create_certificates_table.php',
            'database/migrations/2026_07_07_000001_add_graduation_scheme_to_courses_table.php',
            'database/migrations/2026_07_07_000002_create_enrollment_evaluations_table.php',
            'database/migrations/2026_07_07_000003_add_layout_columns_to_certificate_templates_table.php',
            'database/migrations/2026_07_07_000004_add_snapshot_and_source_to_certificates_table.php',
            'database/migrations/2026_07_08_221025_add_second_signer_to_certificate_templates_table.php',
            'database/migrations/2026_07_08_233747_add_partner_logos_to_certificate_templates_table.php',
        ];
    }
}

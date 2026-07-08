<?php

namespace App\Http\Controllers\Admin;

use App\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UploadStudentCertificateRequest;
use App\Jobs\IssueCertificateFromTemplateJob;
use App\Models\CertificateTemplate;
use App\Models\Core\File;
use App\Models\Enrollment;
use App\Models\EnrollmentCertificateUpload;
use App\Models\User\User;
use App\Services\CertificateService;
use App\Services\CourseProgressService;
use App\Services\GradingService;
use App\Services\Instructor\StudentProgressBuilder;
use App\Traits\HasInitials;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class StudentCertificateUploadController extends Controller {
    use HasInitials;

    public function __construct(
        private CourseProgressService $courseProgressService,
        private StudentProgressBuilder $progressBuilder,
        private CertificateService $certificateService,
    ) {}

    public function index(): Response {
        return Inertia::render('Admin/StudentCertificateUploads/index', [
            'students' => $this->buildStudentList(),
        ]);
    }

    public function show(User $user): Response {
        $enrollments = Enrollment::query()
            ->where('user_id', $user->id)
            ->where(function ($query) {
                $query
                    ->where('status', FormStatus::ACTIVE->value)
                    ->orWhereNull('status');
            })
            ->with([
                'course:id,title,created_by',
                'course.creator:id,name',
                'course.sections:id,course_id,title,order',
                'course.sections.contents:id,section_id,title,type,order',
                'certificateUpload.file:id,name,extension',
            ])
            ->get();

        $studentIds = collect([(string) $user->id]);
        $contentIds = $enrollments
            ->flatMap(fn ($enrollment) => $enrollment->course->sections->flatMap->contents->pluck('id'))
            ->map(static fn ($contentId) => (string) $contentId)
            ->unique()
            ->values();

        [$completedLookupByUser] = $this->progressBuilder->buildCompletedContentMaps($studentIds, $contentIds);
        [$submittedLookupByUser] = $this->progressBuilder->buildSubmittedContentMaps($studentIds, $contentIds);

        $completedLookup = $completedLookupByUser[(string) $user->id] ?? [];
        $submittedLookup = $submittedLookupByUser[(string) $user->id] ?? [];

        $selectedStudentCourses = $enrollments->map(function ($enrollment) use ($completedLookup, $submittedLookup) {
            $courseContents = $enrollment->course->sections->flatMap->contents;

            $progress = $this->courseProgressService->calculateProgress(
                $courseContents,
                $completedLookup,
                $submittedLookup,
            );

            $upload = $enrollment->certificateUpload;

            return [
                'enrollmentId'   => (string) $enrollment->id,
                'courseId'       => (string) $enrollment->course_id,
                'courseTitle'    => (string) $enrollment->course->title,
                'instructorName' => $enrollment->course->creator?->name,
                'progress'       => $progress,
                'certificate'    => $upload && $upload->file ? [
                    'fileId'     => (string) $upload->file_id,
                    'fileName'   => $upload->file->name,
                    'uploadedAt' => $upload->uploaded_at->format('d M Y H:i'),
                    'previewUrl' => route('files.preview', $upload->file_id),
                ] : null,
            ];
        })->values();

        return Inertia::render('Admin/StudentCertificateUploads/index', [
            'students'               => $this->buildStudentList(),
            'selectedStudentId'      => (string) $user->id,
            'selectedStudentCourses' => $selectedStudentCourses,
        ]);
    }

    public function upload(UploadStudentCertificateRequest $request, Enrollment $enrollment): RedirectResponse {
        $enrollment->load([
            'course.sections.contents',
            'certificateUpload.file',
        ]);

        $studentIds = collect([(string) $enrollment->user_id]);
        $contentIds = $enrollment->course->sections->flatMap->contents->pluck('id')
            ->map(static fn ($contentId) => (string) $contentId)
            ->values();

        [$completedLookupByUser] = $this->progressBuilder->buildCompletedContentMaps($studentIds, $contentIds);
        [$submittedLookupByUser] = $this->progressBuilder->buildSubmittedContentMaps($studentIds, $contentIds);

        $progress = $this->courseProgressService->calculateProgress(
            $enrollment->course->sections->flatMap->contents,
            $completedLookupByUser[(string) $enrollment->user_id] ?? [],
            $submittedLookupByUser[(string) $enrollment->user_id] ?? [],
        );

        if ($progress < 100) {
            return back()->withErrors([
                'files' => 'Progress course belum 100%.',
            ]);
        }

        try {
            $this->certificateService->assertEvaluationFinalAndPassed($enrollment);
        } catch (\RuntimeException $e) {
            return back()->withErrors([
                'files' => $e->getMessage(),
            ]);
        }

        $oldFile = $enrollment->certificateUpload?->file;

        $uploadedFile = null;
        File::uploadFile(
            $request,
            'EnrollmentCertificateUploads',
            function (File $file) use (&$uploadedFile): void {
                $uploadedFile = $file;
            },
            ['is_public' => false],
        );

        if ($uploadedFile === null) {
            return back()->withErrors([
                'files' => 'Sertifikat gagal diunggah.',
            ]);
        }

        EnrollmentCertificateUpload::updateOrCreate(
            ['enrollment_id' => $enrollment->id],
            [
                'file_id'     => $uploadedFile->id,
                'uploaded_by' => auth()->id(),
                'uploaded_at' => now(),
            ],
        );

        // File lama baru dihapus setelah penggantinya tersimpan dan baris
        // ter-update, supaya tidak ada referensi ke file yang sudah terhapus.
        if ($oldFile && $oldFile->id !== $uploadedFile->id) {
            Storage::delete($oldFile->path);
            $oldFile->delete();
        }

        return back()->with('success', 'Sertifikat berhasil diupload.');
    }

    public function issueFromTemplate(Enrollment $enrollment): RedirectResponse {
        $template = CertificateTemplate::where('course_id', $enrollment->course_id)->where('is_active', true)->first()
            ?? CertificateTemplate::whereNull('course_id')->where('is_active', true)->first();

        if (! $template) {
            return back()->withErrors(['files' => 'Tidak ada template sertifikat aktif.']);
        }

        if ($enrollment->certificate) {
            return back()->withErrors(['files' => 'Sertifikat sudah pernah diterbitkan.']);
        }

        try {
            $this->certificateService->assertEvaluationFinalAndPassed($enrollment);
        } catch (\RuntimeException $e) {
            return back()->withErrors(['files' => $e->getMessage()]);
        }

        IssueCertificateFromTemplateJob::dispatch($enrollment);

        return back()->with('success', 'Sertifikat sedang diproses, akan muncul beberapa saat lagi.');
    }

    private function buildStudentList() {
        $enrollments = Enrollment::query()
            ->where(function ($query) {
                $query
                    ->where('status', FormStatus::ACTIVE->value)
                    ->orWhereNull('status');
            })
            ->with([
                'user:id,name,email,image,updated_at',
                'course:id,title',
            ])
            ->orderByDesc('enrolled_at')
            ->get();

        return $enrollments
            ->groupBy('user_id')
            ->map(function ($userEnrollments) {
                $user = $userEnrollments->first()->user;

                return [
                    'id'            => (string) $user->id,
                    'name'          => (string) $user->name,
                    'avatar'        => $this->initials((string) $user->name),
                    'image'         => $user->image !== null ? (string) $user->image : null,
                    'updated_at'    => $user->updated_at?->toIso8601String(),
                    'email'         => (string) $user->email,
                    'totalCourses'  => $userEnrollments->count(),
                ];
            })
            ->values();
    }
}

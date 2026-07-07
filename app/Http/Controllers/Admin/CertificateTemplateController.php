<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\Course;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class CertificateTemplateController extends Controller {
    public function index(): Response {
        $templates = CertificateTemplate::with('course', 'creator')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($t) => [
                'id'             => $t->id,
                'name'           => $t->name,
                'gdocTemplateId' => $t->gdoc_template_id,
                'docsEditUrl'    => $t->docs_edit_url,
                'isInternal'     => $t->isInternalTemplate(),
                'frontContent'   => $t->front_content,
                'backContent'    => $t->back_content,
                'signerName'     => $t->signer_name,
                'signerTitle'    => $t->signer_title,
                'courseName'     => $t->course?->title ?? 'Default (All Courses)',
                'courseId'       => $t->course_id,
                'isActive'       => $t->is_active,
                'totalIssued'    => Certificate::where('certificate_template_id', $t->id)->count(),
                'createdAt'      => $t->created_at->format('d M Y'),
            ]);

        $courses = Course::where('is_published', true)
            ->orderBy('title')
            ->get(['id', 'title']);

        return Inertia::render('Admin/CertificateTemplates/index', [
            'templates' => $templates,
            'courses'   => $courses,
        ]);
    }

    public function store(Request $request): RedirectResponse {
        $validated = $request->validate([
            'name'             => ['required', 'string', 'max:255'],
            'gdoc_template_id' => ['nullable', 'string', 'max:255'],
            'course_id'        => ['nullable', 'exists:courses,id'],
            'is_active'        => ['boolean'],
            'front_content'    => ['nullable', 'string'],
            'back_content'     => ['nullable', 'string'],
            'signer_name'      => ['nullable', 'string', 'max:255'],
            'signer_title'     => ['nullable', 'string', 'max:255'],
        ]);

        CertificateTemplate::create([
            ...$validated,
            'created_by'   => Auth::id(),
            'placeholders' => [
                'student_name', 'course_title', 'issued_date',
                'expiry_date', 'credential_id', 'certificate_type',
            ],
        ]);

        return back()->with('success', 'Template sertifikat berhasil ditambahkan.');
    }

    public function update(Request $request, CertificateTemplate $certificateTemplate): RedirectResponse {
        $validated = $request->validate([
            'name'             => ['required', 'string', 'max:255'],
            'gdoc_template_id' => ['nullable', 'string', 'max:255'],
            'course_id'        => ['nullable', 'exists:courses,id'],
            'is_active'        => ['boolean'],
            'front_content'    => ['nullable', 'string'],
            'back_content'     => ['nullable', 'string'],
            'signer_name'      => ['nullable', 'string', 'max:255'],
            'signer_title'     => ['nullable', 'string', 'max:255'],
        ]);

        $certificateTemplate->update($validated);

        return back()->with('success', 'Template sertifikat berhasil diperbarui.');
    }

    public function destroy(CertificateTemplate $certificateTemplate): RedirectResponse {
        $certificateTemplate->delete();

        return back()->with('success', 'Template sertifikat berhasil dihapus.');
    }
}

<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\CourseContent;
use App\Models\Submission;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class SubmissionController extends Controller {
    public function store(Request $request, CourseContent $content) {
        if (! $content->isSubmissionType()) {
            abort(Response::HTTP_UNPROCESSABLE_ENTITY, 'Content type is not submittable.');
        }

        if ($content->hasDeadlinePassed()) {
            return back()->withErrors([
                'submission' => 'Deadline sudah lewat.',
            ]);
        }

        $validatedData = $request->validate([
            'notes'     => ['nullable', 'string', 'max:1000'],
            'files'     => ['nullable', 'array', 'required_without:filesId'],
            'files.*'   => ['required_with:files', 'file', 'max:10240'],
            'isPublic'  => ['nullable', 'array'],
            'name'      => ['nullable', 'array'],
            'filesId'   => ['nullable', 'array', 'required_without:files'],
            'filesId.*' => ['required_with:filesId', 'string', 'exists:files,id'],
        ]);

        DB::transaction(function () use ($content, $request, $validatedData): void {
            $submission = Submission::updateOrCreate([
                'user_id'    => $request->user()->id,
                'content_id' => $content->id,
            ], [
                'notes'        => $validatedData['notes'] ?? null,
                'status'       => 'submitted',
                'submitted_at' => now(),
            ]);

            if (! empty($validatedData['filesId'])) {
                $fileIds = File::query()
                    ->whereIn('id', $validatedData['filesId'])
                    ->pluck('id');

                foreach ($fileIds as $fileId) {
                    $existingLink = Fileable::withTrashed()
                        ->where('file_id', $fileId)
                        ->where('fileable_id', $submission->id)
                        ->where('fileable_type', Submission::class)
                        ->first();

                    if ($existingLink) {
                        if ($existingLink->trashed()) {
                            $existingLink->restore();
                        }

                        continue;
                    }

                    Fileable::create([
                        'file_id'       => $fileId,
                        'fileable_id'   => $submission->id,
                        'fileable_type' => Submission::class,
                    ]);
                }
            }

            if ($request->hasFile('files')) {
                foreach ($request->file('files') as $index => $uploadedFile) {
                    $customName  = trim((string) ($validatedData['name'][$index] ?? ''));
                    $displayName = $customName !== '' ?
                        $customName :
                        pathinfo($uploadedFile->getClientOriginalName(), PATHINFO_FILENAME);
                    $storedPath = $uploadedFile->store('files');

                    $file = File::create([
                        'name'          => $displayName,
                        'path'          => $storedPath,
                        'extension'     => $uploadedFile->getClientOriginalExtension(),
                        'mime_type'     => $uploadedFile->getMimeType() ?? $uploadedFile->getClientMimeType() ?? 'application/octet-stream',
                        'is_public'     => filter_var($validatedData['isPublic'][$index] ?? false, FILTER_VALIDATE_BOOLEAN),
                        'created_by_id' => $request->user()->id,
                    ]);

                    Fileable::create([
                        'file_id'       => $file->id,
                        'fileable_id'   => $submission->id,
                        'fileable_type' => Submission::class,
                    ]);
                }
            }
        });

        return back()->with('success', 'Berhasil dikumpulkan!');
    }

    public function destroyFile(Request $request, CourseContent $content, File $file) {
        if (! $content->isSubmissionType()) {
            abort(Response::HTTP_UNPROCESSABLE_ENTITY, 'Content type is not submittable.');
        }

        if ($content->hasDeadlinePassed()) {
            return back()->withErrors([
                'submission' => 'Deadline sudah lewat.',
            ]);
        }

        $submission = Submission::query()
            ->where('content_id', $content->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        Fileable::query()
            ->where('fileable_id', $submission->id)
            ->where('fileable_type', Submission::class)
            ->where('file_id', $file->id)
            ->forceDelete();

        $hasRemainingFile = Fileable::query()
            ->where('fileable_id', $submission->id)
            ->where('fileable_type', Submission::class)
            ->exists();

        if (! $hasRemainingFile) {
            $submission->delete();
        }

        return back()->with('success', 'File submission berhasil dihapus.');
    }
}

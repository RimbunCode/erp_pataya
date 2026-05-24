<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Core\File;
use App\Models\RoleRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ProfileController extends Controller {
    public function index() {
        $user                    = Auth::user();
        $profile                 = $user->studentProfile;
        $latestInstructorRequest = RoleRequest::query()
            ->with(['reviewer:id,name', 'proofFile:id,name,extension'])
            ->where('user_id', $user->id)
            ->where('requested_role', 'instructor')
            ->latest('created_at')
            ->first();

        return Inertia::render('Students/ProfileSettings', [
            'user'                    => $user,
            'profile'                 => $profile,
            'latestInstructorRequest' => $latestInstructorRequest
                ? [
                    'id'            => (string) $latestInstructorRequest->id,
                    'status'        => (string) $latestInstructorRequest->status,
                    'reason'        => (string) $latestInstructorRequest->reason,
                    'submittedAt'   => $latestInstructorRequest->created_at?->toIso8601String(),
                    'rejectReason'  => $latestInstructorRequest->rejection_reason,
                    'reviewedAt'    => $latestInstructorRequest->reviewed_at?->toIso8601String(),
                    'reviewedBy'    => $latestInstructorRequest->reviewer?->name,
                    'proofUrl'      => route('files.preview', $latestInstructorRequest->proof_file_id),
                    'proofFileName' => $latestInstructorRequest->proofFile
                        ? trim("{$latestInstructorRequest->proofFile->name}.{$latestInstructorRequest->proofFile->extension}", '.')
                        : null,
                ]
                : null,
        ]);
    }

    public function update(Request $request) {
        $request->validate([
            'name'               => ['required', 'string', 'max:255'],
            'phone'              => ['nullable', 'string', 'max:20'],
            'gender'             => ['nullable', 'in:male,female'],
            'birthdate'          => ['nullable', 'date'],
            'institution'        => ['nullable', 'string', 'max:255'],
            'student_id_number'  => ['nullable', 'string', 'max:50'],
            'socials'            => ['nullable', 'array'],
            'socials.*.platform' => ['required', 'string'],
            'socials.*.url'      => ['required', 'url'],
            'bio'                => ['nullable', 'string'],
        ]);

        $user = Auth::user();

        // Update user
        $user->update([
            'name'      => $request->name,
            'phone'     => $request->phone,
            'gender'    => $request->gender,
            'birthdate' => $request->birthdate,
        ]);

        $user->studentProfile()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'institution'       => $request->institution,
                'student_id_number' => $request->student_id_number,
                'socials'           => $request->socials ?? [],
                'bio'               => $request->bio,
            ],
        );

        return back()->with('success', 'Profile updated successfully.');
    }

    public function destroyImage() {
        $user = Auth::user();

        $image_id = $user->image;
        $user->update([
            'image' => null,
        ]);
        File::find($image_id)?->delete();

        return back()->with('success', 'Image deleted successfully.');
    }

    public function updateAvatar(Request $request) {
        DB::beginTransaction();

        try {
            $user = $request->user();

            File::uploadFile($request, 'ImageProfile', function ($file) use ($user) {
                $user->update([
                    'image' => $file->id,
                ]);
            });

            DB::commit();

            return back();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }
}

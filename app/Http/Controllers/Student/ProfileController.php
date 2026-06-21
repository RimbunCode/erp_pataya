<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\BaseProfileController;
use App\Models\RoleRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ProfileController extends BaseProfileController {
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

    protected function validationRules(): array {
        return [
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
        ];
    }

    protected function userFields(Request $request): array {
        return [
            'name'      => $request->name,
            'phone'     => $request->phone,
            'gender'    => $request->gender,
            'birthdate' => $request->birthdate,
        ];
    }

    protected function updateProfileData(Request $request): void {
        $user = Auth::user();

        $user->studentProfile()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'institution'       => $request->institution,
                'student_id_number' => $request->student_id_number,
                'socials'           => $request->socials ?? [],
                'bio'               => $request->bio,
            ],
        );
    }
}

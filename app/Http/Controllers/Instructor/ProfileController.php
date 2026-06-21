<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\BaseProfileController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ProfileController extends BaseProfileController {
    public function index() {
        $user    = Auth::user();
        $profile = $user->instructorProfile;

        return Inertia::render('Instructors/ProfileSettings', [
            'user'    => $user,
            'profile' => $profile,
        ]);
    }

    protected function validationRules(): array {
        return [
            'name'                => ['required', 'string', 'max:255'],
            'email'               => ['required', 'email'],
            'phone'               => ['nullable', 'string', 'max:20'],
            'professional_title'  => ['nullable', 'string', 'max:100'],
            'expertise'           => ['nullable', 'string', 'max:255'],
            'academic_background' => ['nullable', 'string'],
            'years_of_experience' => ['nullable', 'integer', 'min:0'],
            'bio'                 => ['nullable', 'string'],
            'socials'             => ['nullable', 'array'],
            'socials.*.platform'  => ['nullable', 'string'],
            'socials.*.url'       => ['nullable', 'url'],
        ];
    }

    protected function userFields(Request $request): array {
        return [
            'name'  => $request->name,
            'phone' => $request->phone,
            'email' => $request->email,
        ];
    }

    protected function updateProfileData(Request $request): void {
        $user = Auth::user();

        $user->instructorProfile()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'professional_title'  => $request->professional_title,
                'expertise'           => $request->expertise,
                'bank_name'           => $request->bank_name,
                'bank_account_number' => $request->bank_account_number,
                'bio'                 => $request->bio,
                'socials'             => $request->socials ?? [],
            ],
        );
    }
}

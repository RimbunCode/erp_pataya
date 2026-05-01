<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ProfileController extends Controller {
    public function index() {
        $user    = Auth::user();
        $profile = $user->studentProfile;

        return Inertia::render('Students/ProfileSettings', [
            'user' => [
                'id'        => $user->id,
                'name'      => $user->name,
                'email'     => $user->email,
                'phone'     => $user->phone,
                'birthdate' => $user->birthdate?->format('Y-m-d'),
                'gender'    => $user->gender,
                'avatar'    => $user->avatar_url,
            ],
            'profile' => [
                'institution'       => $profile?->institution,
                'student_id_number' => $profile?->student_id_number,
                'socials'           => $profile?->socials ?? [],
            ],
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
            ],
        );

        return back()->with('success', 'Profile updated successfully.');
    }
}
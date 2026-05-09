<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Core\File;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ProfileController extends Controller {
    public function index() {
        $user    = Auth::user();
        $profile = $user->instructorProfile;

        return Inertia::render('Instructors/ProfileSettings', [
            'user'    => $user,
            'profile' => $profile,
        ]);
    }

    public function update(Request $request) {
        $request->validate([
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
        ]);

        $user = Auth::user();

        $user->update([
            'name'  => $request->name,
            'phone' => $request->phone,
            'email' => $request->email,
        ]);

        $user->instructorProfile()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'professional_title' => $request->professional_title,
                'expertise'          => $request->expertise,
                'bio'                => $request->bio,
                'socials'            => $request->socials ?? [],
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
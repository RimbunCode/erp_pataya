<?php

namespace App\Http\Controllers;

use App\Models\Core\File;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

abstract class BaseProfileController extends Controller {
    abstract public function index();

    abstract protected function validationRules(): array;

    abstract protected function updateProfileData(Request $request): void;

    public function update(Request $request): RedirectResponse {
        $request->validate($this->validationRules());

        $user = Auth::user();

        $user->update($this->userFields($request));

        $this->updateProfileData($request);

        return back()->with('success', 'Profile updated successfully.');
    }

    protected function userFields(Request $request): array {
        return [
            'name'  => $request->name,
            'phone' => $request->phone,
        ];
    }

    public function destroyImage(): RedirectResponse {
        $user     = Auth::user();
        $image_id = $user->image;

        $user->update(['image' => null]);
        File::find($image_id)?->delete();

        return back()->with('success', 'Image deleted successfully.');
    }

    public function updateAvatar(Request $request): RedirectResponse {
        DB::beginTransaction();

        try {
            $user = $request->user();

            File::uploadFile($request, 'ImageProfile', function ($file) use ($user) {
                $user->update(['image' => $file->id]);
            });

            DB::commit();

            return back();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }
}

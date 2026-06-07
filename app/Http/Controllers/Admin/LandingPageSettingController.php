<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateLandingPageContentRequest;
use App\Models\Core\File as StoredFile;
use App\Services\Guest\GuestPageContentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LandingPageSettingController extends Controller {
    public function __construct(private GuestPageContentService $guestPageContentService) {}

    public function index(): RedirectResponse {
        return redirect()->route('guest.home', ['liveEdit' => 1]);
    }

    public function update(UpdateLandingPageContentRequest $request): RedirectResponse {
        $validated = $request->validated();

        $this->guestPageContentService->store($validated['content']);

        return back()->with('success', 'Landing page content berhasil diperbarui.');
    }

    public function uploadMedia(Request $request): JsonResponse {
        $validated = $request->validate([
            'file' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $uploadedFile = null;

        StoredFile::uploadFile(
            $validated['file'],
            'LandingPageMedia',
            function (StoredFile $file) use (&$uploadedFile): void {
                $uploadedFile = $file;
            },
            ['is_public' => true],
        );

        if (! $uploadedFile instanceof StoredFile) {
            return response()->json([
                'message' => 'Gagal mengunggah gambar.',
            ], 422);
        }

        return response()->json([
            'id'  => $uploadedFile->id,
            'url' => route('files.preview', ['file' => $uploadedFile->id]),
        ]);
    }
}

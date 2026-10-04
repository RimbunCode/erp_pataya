<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

class FileController extends Controller {
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        if (! Utils::isInertiaRequest($request)) {
            $files = File::query();
            if ($request->has('search')) {
                $files->where('mime_type', 'folder')
                    ->orWhereAny(['name', 'extension'], 'like', "%{$request->search}%");
            } else {
                $files->where('parent_id', $request->folder ?? null);
            }
            $files->where(function ($query) use ($request) {
                $query->where('created_by_id', $request->user()->id)
                    ->orWhereNull('created_by_id');
            });
            // PDF hasil generate (auto-attach saat approval, tanpa pemilik) melekat ke
            // dokumennya dan diotorisasi lewat dokumen itu, bukan lewat library global.
            $files->whereNotIn('id', Fileable::query()->where('is_generated_pdf', true)->select('file_id'));

            return response()->json($files->get());
        }
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request) {
        // TreeView (File use TreeView) sudah membungkus tiap create dalam
        // transaksi + lockForUpdate sendiri. Membungkus lagi dengan transaksi
        // luar menahan lock lama → deadlock/timeout. Biarkan per-create atomik.
        $uploaded = [];
        File::uploadFile($request, 'drafts', function ($file) use (&$uploaded) {
            $uploaded[] = ['id' => $file->id, 'name' => $file->name];
        }, ['is_draft' => true], useFolder: false);

        return response()->json($uploaded);
    }

    /**
     * Display the specified resource.
     */
    public function preview(Request $request, File $file) {
        if (! $file->is_public && ! Auth::check()) {
            abort(403);
        }

        $this->authorizeGeneratedPdf($request, $file);

        if (! Storage::exists($file->path)) {
            abort(404);
        }

        return Storage::response($file->path, $file->name);
    }

    /**
     * PDF hasil generate hanya boleh dibuka oleh user yang berhak membaca dokumen
     * tempat PDF itu dilampirkan (permission `read`, scope cabang, dan only_creator).
     * File biasa (upload/lampiran) tidak terpengaruh.
     */
    private function authorizeGeneratedPdf(Request $request, File $file): void {
        $attachments = Fileable::query()
            ->where('file_id', $file->id)
            ->where('is_generated_pdf', true)
            ->get();

        if ($attachments->isEmpty()) {
            return;
        }

        $allowed = $attachments->contains(function (Fileable $attachment) use ($request) {
            // morphTo memakai global scope model dokumen (mis. cabang); null = di luar jangkauan user.
            $document = $attachment->fileable;
            if (! $document || ! method_exists($document, '_checkPermission')) {
                return false;
            }

            try {
                $onlyCreator = $document::_checkPermission('read');
            } catch (HttpException) {
                return false;
            }

            return ! $onlyCreator || $document->created_by_id === $request->user()->id;
        });

        abort_unless($allowed, 403);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(File $file) {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, File $file) {
        //
    }
}

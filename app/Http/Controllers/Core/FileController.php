<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\File;
use App\Utils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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
                $query->where('user_id', $request->user()->id)
                    ->orWhereNull('user_id');
            });

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
        if ($request->has('files')) {
            $validatedData = $request->validate([
                'files'      => ['required', 'array'],
                'files.*'    => ['required', 'file', 'max:10240'],
                'isGlobal'   => ['required', 'array'],
                'isGlobal.*' => ['required'],
                'name'       => ['required', 'array'],
                'name.*'     => ['required', 'string'],
            ]);
            $validatedData['files'];
        } else {
            $validatedData = $request->validate([
                'file.*'     => ['required', 'file', 'max:10240'],
                'isGlobal.*' => ['required'],
                'name.*'     => ['required', 'string'],
            ]);
        }
        if (! Utils::isInertiaRequest($request)) {
        }
        // try {
        //   $file = $request->validate([
        //     'file' => ['required', 'file', 'max:10240'],
        //   ]);
        //   dd($file);
        // } catch (\Throwable $th) {
        //   //throw $th;
        // }
    }

    /**
     * Display the specified resource.
     */
    public function preview(Request $request, File $file) {
        if (! $file->is_public && ! Auth::check()) {
            abort(403);
        }

        if (! Storage::exists($file->path)) {
            abort(404);
        }

        return Storage::response($file->path, $file->name);
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

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(File $file) {
        DB::beginTransaction();
        $file->delete();
        $file->logForDeleted();
        DB::commit();

        return redirect()->route('files.index');
    }
}

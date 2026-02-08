<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\Preference;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CompanyLogoController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request)
    {
        $fileId = Preference::where('key', 'company_image')->first()?->value;
        if (! $fileId) {
            abort(404);
        }
        $file = \App\Models\Core\File::find($fileId);
        if (! Storage::exists($file->path)) {
            abort(404);
        }

        return Storage::response($file->path, $file->name);
    }
}

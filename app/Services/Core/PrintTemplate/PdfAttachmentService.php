<?php

namespace App\Services\Core\PrintTemplate;

use App\Models\Core\File;
use App\Models\Core\Fileable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Stores a generated PDF as a document attachment (`File` + `Fileable`),
 * shared by both the manual "Download PDF" flow and the automatic
 * attach-on-approval flow.
 *
 * Every call creates a new `File`/`Fileable` record — never overwrites an
 * existing one — so re-generating a PDF for the same document (repeated
 * downloads, or approval on an amended document) preserves prior versions
 * as separate attachments.
 */
class PdfAttachmentService {
    public function attach(string $pdfBytes, Model $document, ?string $userId = null): File {
        $path = Storage::put('files', $pdfBytes);

        $file = File::create([
            'name'          => $this->buildFileName($document),
            'path'          => $path,
            'extension'     => 'pdf',
            'mime_type'     => 'application/pdf',
            'is_public'     => false,
            'created_by_id' => $userId ?? Auth::id(),
        ]);

        Fileable::create([
            'fileable_id'   => $document->getKey(),
            'fileable_type' => $document::class,
            'file_id'       => $file->id,
        ]);

        return $file;
    }

    protected function buildFileName(Model $document): string {
        $label = (string) ($document->code ?? $document->name ?? Str::of($document::class)->classBasename());

        // Microseconds (not just seconds) avoid name collisions when two
        // PDFs are generated for the same document within the same second
        // (e.g. approve, then immediately a manual download) — the File/
        // Fileable records are already distinct via `id`, but the visible
        // file name should be too.
        return $label . '-' . now()->format('YmdHis_u');
    }
}

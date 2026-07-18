<?php

namespace App\Jobs\Core;

use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Core\PrintTemplate;
use App\Notifications\AnonymousEmailNotifiable;
use App\Notifications\EmailTemplateSendNotification;
use App\Services\Core\PrintTemplate\PdfAttachmentService;
use App\Services\Core\PrintTemplate\PdfExportService;
use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Kirim email trigger manual, sekaligus generate PDF (jika diminta dan
 * belum tersimpan) dalam satu unit kerja queue. Berbeda dari
 * `AttachGeneratedPdfJob` (auto-attach saat approval, kegagalan attach
 * TIDAK PERNAH menggagalkan approval) — di sini kegagalan generate PDF,
 * ketika user secara eksplisit meminta `$includePdf`, SENGAJA
 * menggagalkan seluruh job: email tidak boleh terkirim tanpa PDF yang
 * diminta secara diam-diam.
 */
class SendEmailWithPdfJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $modelClass,
        public mixed $documentId,
        public string $to,
        public array $cc,
        public array $bcc,
        public string $subject,
        public string $body,
        public array $fileIds,
        public bool $includePdf,
        public ?string $fromName,
    ) {}

    public function handle(
        PrintTemplateRenderService $renderService,
        PdfExportService $pdfExportService,
        PdfAttachmentService $attachmentService,
    ): void {
        $document = $this->modelClass::findOrFail($this->documentId);

        // Batasi fileIds ke file yang benar-benar ter-attach ke dokumen ini —
        // tanpa ini, user bisa mengirim ID file dokumen lain (termasuk file
        // privat milik dokumen yang tidak mereka punya akses) dan job akan
        // melampirkannya begitu saja (IDOR / kebocoran file arbitrer).
        $allowedFileIds = Fileable::where('fileable_id', $document->getKey())
            ->where('fileable_type', $this->modelClass)
            ->pluck('file_id')
            ->all();
        $fileIds = array_values(array_intersect($this->fileIds, $allowedFileIds));

        if (count($fileIds) !== count($this->fileIds)) {
            Log::warning('SendEmailWithPdfJob: fileIds ditolak karena tidak ter-attach ke dokumen target', [
                'model'      => $this->modelClass,
                'documentId' => $this->documentId,
                'rejected'   => array_values(array_diff($this->fileIds, $allowedFileIds)),
            ]);
        }

        if ($this->includePdf) {
            $existing = Fileable::where('fileable_id', $document->getKey())
                ->where('fileable_type', $this->modelClass)
                ->where('is_generated_pdf', true)
                ->latest()
                ->first();

            if ($existing) {
                $fileIds[] = $existing->file_id;
            } else {
                // Sengaja TIDAK try-catch di sini — kegagalan generate PDF
                // ketika diminta eksplisit harus menggagalkan seluruh job.
                $template  = PrintTemplate::where('model', $this->modelClass)->where('is_default', true)->firstOrFail();
                $html      = $renderService->render($document, $template, $template->columns);
                $pdf       = $pdfExportService->generate($html, $template);
                $file      = $attachmentService->attach($pdf, $document);
                $fileIds[] = $file->id;
            }
        }

        $attachments = File::whereIn('id', $fileIds)
            ->get()
            ->map(fn (File $file) => ['path' => Storage::path($file->path), 'name' => $file->fullname])
            ->toArray();

        Notification::send(
            new AnonymousEmailNotifiable($this->to, $this->cc, $this->bcc),
            new EmailTemplateSendNotification($this->subject, $this->body, $attachments, $this->fromName),
        );
    }

    public function failed(Throwable $e): void {
        Log::error('SendEmailWithPdfJob gagal — email tidak terkirim', [
            'model'      => $this->modelClass,
            'documentId' => $this->documentId,
            'to'         => $this->to,
            'includePdf' => $this->includePdf,
            'error'      => $e->getMessage(),
        ]);
    }
}

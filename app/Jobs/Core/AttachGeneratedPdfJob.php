<?php

namespace App\Jobs\Core;

use App\Models\Core\ApprovalInstance;
use App\Models\Core\PrintTemplate;
use App\Services\Core\PrintTemplate\PdfAttachmentService;
use App\Services\Core\PrintTemplate\PdfExportService;
use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Renders the approved document's default print template to PDF and
 * attaches it, off the request/response cycle. Runs after the approval
 * transaction has already committed (dispatched from
 * ApprovalInstanceController::approve()), so a failure here — missing
 * template, render error, PDF engine failure — only prevents the
 * attachment; it never affects an approval decision that already happened.
 */
class AttachGeneratedPdfJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public ApprovalInstance $approval,
    ) {}

    public function handle(
        PrintTemplateRenderService $renderService,
        PdfExportService $pdfExportService,
        PdfAttachmentService $attachmentService,
    ): void {
        try {
            $document = $this->approval->document;

            if ($document === null) {
                return;
            }

            // Job ini memakai SerializesModels, jadi $this->approval di-refetch
            // dari database saat worker menjalankannya dan relasi yang sudah
            // termuat di request TIDAK ikut terbawa. Tanpa loadMissing, helper
            // {{{approvalSignature}}} memicu query terpisah untuk tiap step.
            //
            // Seluruh steps dimuat, bukan hanya yang approved: penentuan
            // penandatangan final menyaring di memori (lihat
            // SignatureResolverService::resolveFinalStep), dan jumlah step per
            // dokumen kecil.
            // Dijaga method_exists: loadMissing() MELEMPAR untuk relasi
            // yang tidak ada, dan tidak semua model yang bisa dicetak punya
            // approval. Kegagalan di sini akan tertelan catch di bawah dan
            // membatalkan seluruh lampiran PDF, bukan sekadar tanda tangannya.
            if (method_exists($document, 'approvalable')) {
                $document->loadMissing('approvalable.steps.actedBy.signatureFile');
            }

            $template = PrintTemplate::where('model', $document::class)
                ->where('is_default', true)
                ->first();

            if ($template === null) {
                Log::info('PDF auto-attach skipped: no default PrintTemplate configured', [
                    'model'       => $document::class,
                    'document_id' => $document->getKey(),
                ]);

                return;
            }

            $columns = $template->columns;
            $html    = $renderService->render($document, $template, $columns);
            $pdf     = $pdfExportService->generate($html, $template);

            $attachmentService->attach($pdf, $document);
        } catch (Throwable $e) {
            Log::error('PDF auto-attach failed after approval', [
                'approval_instance_id' => $this->approval->id,
                'error'                => $e->getMessage(),
            ]);
        }
    }
}

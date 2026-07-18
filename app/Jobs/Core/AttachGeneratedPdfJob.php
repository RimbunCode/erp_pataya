<?php

namespace App\Jobs\Core;

use App\Models\Core\ApprovalInstance;
use App\Models\Core\PrintTemplate;
use App\Services\Core\PrintTemplate\PdfAttachmentService;
use App\Services\Core\PrintTemplate\PdfExportService;
use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use ReflectionMethod;
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
            $controller = (string) ($this->approval->options['controller'] ?? '');
            $document   = $this->resolveDocumentModel($controller, $this->approval->options['parameters'] ?? []);

            if ($document === null) {
                return;
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

    /**
     * Resolve the document model instance the approval was created for,
     * using the same route-model resolution as
     * ApprovalInstanceController::callWithRouteModels(): inspect the
     * target controller's `onApproved` method signature and find the
     * first typed parameter that is a Model subclass present in the
     * stored route parameters.
     *
     * @param  array<string, mixed>  $rawParams
     */
    protected function resolveDocumentModel(string $controller, array $rawParams): ?Model {
        if ($controller === '' || ! method_exists($controller, 'onApproved')) {
            return null;
        }

        $ref = new ReflectionMethod($controller, 'onApproved');

        foreach ($ref->getParameters() as $param) {
            $type = $param->getType();
            if (! $type || $type->isBuiltin()) {
                continue;
            }

            $className = $type->getName();
            if (! is_subclass_of($className, Model::class)) {
                continue;
            }

            $name = $param->getName();
            if (isset($rawParams[$name])) {
                return $className::find($rawParams[$name]);
            }
        }

        return null;
    }
}

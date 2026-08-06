<?php

namespace App\Listeners\Core\Submission;

use App\Events\Core\DocumentSubmitted;
use Illuminate\Contracts\Queue\ShouldQueue;

class CreateDocumentConnection implements ShouldQueue {
    public function handle(DocumentSubmitted $event): void {
        if (! $event->reference) {
            return;
        }

        $event->document->attachConnections($event->reference, $event->data);
    }
}

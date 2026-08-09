<?php

namespace App\Listeners\Core\Submission;

use App\Events\Core\DocumentSubmitted;

class CreateDocumentConnection {
    public function handle(DocumentSubmitted $event): void {
        if (! $event->reference) {
            return;
        }

        $event->document->attachConnections($event->reference, $event->data);
    }
}

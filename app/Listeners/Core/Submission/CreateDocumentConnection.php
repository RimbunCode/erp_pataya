<?php

namespace App\Listeners\Core\Submission;

use App\Events\Core\DocumentSubmitted;
use App\Models\Core\ModelConnection;

class CreateDocumentConnection {
    public function handle(DocumentSubmitted $event): void {
        if (! $event->reference) {
            return;
        }

        /**
         * Koneksi tingkat pertama (dokumen -> induk langsung) dicatat di sini.
         *
         * attachConnections() tidak bisa dipakai untuk ini: ia membaca
         * $reference->referenceable sebagai sumber, sehingga dokumen yang
         * induknya tidak punya referenceable (PurchaseOrder, Opportunity,
         * WorkOrder, SalesInvoice) keluar lewat guard tanpa menulis apa pun.
         */
        ModelConnection::createConnection([
            'model'     => $event->reference,
            'reference' => $event->document,
            'data'      => $event->data,
        ]);

        /**
         * Lanjutkan menyusuri rantai di atas induk hanya bila induk tersebut
         * memang punya referenceable, karena attachConnections() mengakses
         * parentRelation yang melempar LogicException pada model header
         * (static $parentRelation hanya didefinisikan di model item).
         */
        if ($event->reference->referenceable_type && $event->reference->referenceable_id) {
            $event->document->attachConnections($event->reference, $event->data);
        }
    }
}

<?php

namespace Tests\Unit\Purchase;

use App\Enums\FormStatus;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PurchaseRequestStatusTest extends TestCase {
    #[DataProvider('orderedQuantityProvider')]
    public function test_append_status_reflects_ordered_quantity_progress(
        float $quantity,
        float $orderedQuantity,
        float $receivedQuantity,
        FormStatus $expected,
    ): void {
        $purchaseRequest         = new PurchaseRequest;
        $purchaseRequest->status = [FormStatus::TO_ORDER];
        $purchaseRequest->setRelation('items', collect([
            tap(new PurchaseRequestItem, function ($item) use ($quantity, $orderedQuantity, $receivedQuantity) {
                $item->quantity          = $quantity;
                $item->ordered_quantity  = $orderedQuantity;
                $item->received_quantity = $receivedQuantity;
            }),
        ]));

        $this->assertTrue($purchaseRequest->append_status->contains($expected->value));
    }

    public static function orderedQuantityProvider(): array {
        return [
            'belum ada PO sama sekali tetap TO_ORDER'                                 => [10.0, 0.0, 0.0, FormStatus::TO_ORDER],
            'sebagian dipesan'                                                        => [10.0, 4.0, 0.0, FormStatus::PARTIALLY_ORDERED],
            'sudah dipesan penuh, belum diterima'                                     => [10.0, 10.0, 0.0, FormStatus::ORDERED],
            'sudah dipesan penuh, sebagian diterima'                                  => [10.0, 10.0, 4.0, FormStatus::ORDERED],
            'sudah dipesan penuh, sudah diterima semua'                               => [10.0, 10.0, 10.0, FormStatus::COMPLETED],
            'sebagian dipesan, walau sudah diterima (harusnya belum mungkin terjadi)' => [10.0, 4.0, 4.0, FormStatus::PARTIALLY_ORDERED],
        ];
    }
}

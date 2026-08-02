<?php

namespace App\Services\Sales;

use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Sales\SalesOrderItem;
use Carbon\Carbon;

class RentalDurationService {
    /**
     * @return array{segments: array<array{quantity: float, start_date: Carbon, end_date: Carbon, duration_days: int, status: string}>, status: 'running'|'completed'|'partially_completed'|null}
     */
    public function calculateDuration(SalesOrderItem $item, ?Carbon $cutoffDate = null): array {
        $deliveryItems = $item->deliveryNoteItems()
            ->whereNull('return_against_item_id')
            ->with('deliveryNote')
            ->get();

        if ($deliveryItems->isEmpty()) {
            return [
                'segments' => [],
                'status'   => null,
            ];
        }

        $segments     = [];
        $anyRunning   = false;
        $anyCompleted = false;

        foreach ($deliveryItems as $deliveryItem) {
            $shippedDate = $deliveryItem->deliveryNote->delivery_date;
            $returnItems = DeliveryNoteItem::where('return_against_item_id', $deliveryItem->id)
                ->with('deliveryNote')
                ->get();

            if ($returnItems->isEmpty()) {
                $anyRunning = true;
                $endDate    = $cutoffDate ?? Carbon::today();
                $segments[] = [
                    'quantity'      => $deliveryItem->quantity,
                    'start_date'    => $shippedDate,
                    'end_date'      => $endDate,
                    'duration_days' => $this->diffInDaysInclusive($shippedDate, $endDate),
                    'status'        => 'running',
                ];

                continue;
            }

            $returnedQty = $returnItems->sum('quantity');
            foreach ($returnItems as $returnItem) {
                $anyCompleted = true;
                $segments[]   = [
                    'quantity'      => $returnItem->quantity,
                    'start_date'    => $shippedDate,
                    'end_date'      => $returnItem->deliveryNote->delivery_date,
                    'duration_days' => $this->diffInDaysInclusive($shippedDate, $returnItem->deliveryNote->delivery_date),
                    'status'        => 'completed',
                ];
            }

            $remainingQty = $deliveryItem->quantity - $returnedQty;
            if ($remainingQty > 0) {
                $anyRunning = true;
                $endDate    = $cutoffDate ?? Carbon::today();
                $segments[] = [
                    'quantity'      => $remainingQty,
                    'start_date'    => $shippedDate,
                    'end_date'      => $endDate,
                    'duration_days' => $this->diffInDaysInclusive($shippedDate, $endDate),
                    'status'        => 'running',
                ];
            }
        }

        $status = match (true) {
            $anyRunning && $anyCompleted => 'partially_completed',
            $anyRunning                  => 'running',
            default                      => 'completed',
        };

        return [
            'segments' => $segments,
            'status'   => $status,
        ];
    }

    public function diffInDaysInclusive(Carbon $start, Carbon $end): int {
        return $start->copy()->startOfDay()->diffInDays($end->copy()->startOfDay()) + 1;
    }

    public function calculateAmount(float $monthlyRate, int $durationDays): float {
        if ($durationDays <= 30) {
            return $monthlyRate / 30 * $durationDays;
        }

        $fullMonths    = intdiv($durationDays, 30);
        $remainingDays = $durationDays % 30;

        return ($fullMonths * $monthlyRate) + ($remainingDays * ($monthlyRate / 30));
    }
}

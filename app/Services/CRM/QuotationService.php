<?php

namespace App\Services\CRM;

use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\CRM\Quotation;
use Symfony\Component\Uid\Ulid;

class QuotationService {
    private function fillRelations(array $data): array {
        $data['customer_id']    = $data['customer']['id'] ?? null;
        $data['opportunity_id'] = $data['opportunity']['id'] ?? null;

        return $data;
    }

    public function create(array $data): Quotation {
        $data['code'] = FormatingSeries::generate(Quotation::class, $data, true);
        $quotation    = Quotation::create($this->fillRelations($data));

        $amount = 0;
        foreach ($data['items'] as $item) {
            $item['item_id'] = $item['item']['id'];
            $itemModel       = $quotation->items()->create($item);
            $itemModel->refresh();
            $amount += $itemModel->amount;
        }
        $quotation->update(['amount' => $amount]);
        $quotation->logForCreated();

        return $quotation;
    }

    public function update(Quotation $quotation, array $data): Quotation {
        $quotation->fillForUpdate($this->fillRelations($data), true);

        $quotation->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $quotation->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        $amount = 0;
        foreach ($data['items'] as $item) {
            $item['item_id'] = $item['item']['id'];

            if (Ulid::isValid($item['id'])) {
                $itemModel = $existingItems->get($item['id']);
                if ($itemModel) {
                    $itemModel->fill($item);
                    $itemModel->save();
                } else {
                    $itemModel = $quotation->items()->create($item);
                }
            } else {
                $itemModel = $quotation->items()->create($item);
            }

            $itemModel->refresh();
            $amount += $itemModel->amount;
        }
        $quotation->fill(['amount' => $amount]);
        $quotation->save();
        $quotation->logForUpdated();

        return $quotation;
    }

    public function submit(Quotation $quotation): Quotation {
        $quotation->update([
            'code' => FormatingSeries::generate(Quotation::class, $quotation),
        ]);

        if ($quotation->referenceable_type && $quotation->referenceable_id) {
            ModelConnection::create([
                'model_type'     => $quotation->referenceable_type,
                'model_id'       => $quotation->referenceable_id,
                'reference_type' => Quotation::class,
                'reference_id'   => $quotation->id,
            ]);
        }

        $quotation->checkApproval();

        return $quotation;
    }

    public function cancel(Quotation $quotation): Quotation {
        $quotation->update([
            'status' => [FormStatus::CANCELED],
        ]);

        return $quotation;
    }
}

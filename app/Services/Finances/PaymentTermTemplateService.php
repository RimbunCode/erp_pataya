<?php

namespace App\Services\Finances;

use App\Models\Finances\PaymentTermTemplate;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class PaymentTermTemplateService {
    private function fillItemRelations(array $data) {
        $data['payment_method_id'] = $data['payment_method']['id'] ?? null;

        return $data;
    }

    public function create(array $data) {
        DB::beginTransaction();
        $paymentTermTemplate = PaymentTermTemplate::create($data);

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item);
            $paymentTermTemplate->items()->create($item);
        }

        DB::commit();

        return $paymentTermTemplate;
    }

    public function update(PaymentTermTemplate $paymentTermTemplate, array $data) {
        DB::beginTransaction();
        $paymentTermTemplate->fillForUpdate($data);

        $paymentTermTemplate->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $paymentTermTemplate->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item);

            if (Ulid::isValid($item['id'])) {
                $existingItems->get($item['id'])?->update($item);

                continue;
            }
            $paymentTermTemplate->items()->create($item);
        }

        DB::commit();

        return $paymentTermTemplate;
    }
}
